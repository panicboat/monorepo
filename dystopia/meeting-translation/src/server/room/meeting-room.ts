import { createHash, timingSafeEqual } from "node:crypto";

import type { ClientMessage, Caption, Participant, SpeechLanguage } from "../../shared/meeting.js";
import type {
  RecognitionSession,
  RoomConnection,
  SpeechRecognizer,
  Translator,
} from "../adapters/contracts.js";
import { TranslationQueue } from "./translation-queue.js";

const MAX_PARTICIPANTS = 3;
const MAX_CONTEXT_CAPTIONS = 12;

export interface MeetingRoomDependencies {
  roomId: string;
  joinTokenHash: Buffer;
  translator: Translator;
  recognizer: SpeechRecognizer;
  glossary?: readonly string[];
}

interface ActiveParticipant {
  participant: Participant;
  connection: RoomConnection;
  recognition: {
    generation: number;
    completion: Promise<void>;
    startRequest?: { generation: number; completion: Promise<void> };
    attempt?: RecognitionAttempt;
  };
}

interface RecognitionAttempt {
  active: boolean;
  session?: RecognitionSession;
  stopping?: Promise<void>;
}

export type RoomJoinResult =
  | { ok: true; participant: Participant }
  | { ok: false; code: "invalid_message" | "room_full" | "room_not_found" };

export class MeetingRoom {
  private readonly participants = new Map<string, ActiveParticipant>();
  private readonly participantLifecycles = new Set<ActiveParticipant>();
  private readonly captions = new Map<string, Caption>();
  private readonly context: Caption[] = [];
  private readonly translationQueue: TranslationQueue;
  private sequence = 0;
  private destroyed = false;
  private destroying?: Promise<void>;

  constructor(private readonly dependencies: MeetingRoomDependencies) {
    this.translationQueue = new TranslationQueue(dependencies.translator);
  }

  get isEmpty(): boolean {
    return this.participants.size === 0;
  }

  join(connection: RoomConnection, message: ClientMessage): RoomJoinResult {
    if (message.type !== "join") return { ok: false, code: "invalid_message" };
    if (!this.matchesJoinToken(message) || this.destroyed) return { ok: false, code: "room_not_found" };
    if (this.participants.size >= MAX_PARTICIPANTS) return { ok: false, code: "room_full" };

    const participant: Participant = {
      id: crypto.randomUUID(),
      displayName: message.displayName,
      speechLanguage: message.speechLanguage,
      displayLanguage: message.displayLanguage,
    };
    const activeParticipant: ActiveParticipant = {
      participant,
      connection,
      recognition: { generation: 0, completion: Promise.resolve() },
    };
    this.participants.set(participant.id, activeParticipant);
    this.participantLifecycles.add(activeParticipant);

    connection.send({
      type: "room:joined",
      participantId: participant.id,
      participants: [...this.participants.values()].map(({ participant: member }) => member),
    });
    this.broadcast({ type: "participant:joined", participant }, participant.id);

    return { ok: true, participant };
  }

  async disconnect(participantId: string): Promise<Participant | undefined> {
    const activeParticipant = this.participants.get(participantId);
    if (!activeParticipant) return undefined;

    this.participants.delete(participantId);
    await this.stopRecognition(activeParticipant);
    this.participantLifecycles.delete(activeParticipant);
    this.broadcast({ type: "participant:left", participant: activeParticipant.participant });
    return activeParticipant.participant;
  }

  async handle(participantId: string, message: Exclude<ClientMessage, { type: "join" }>): Promise<void> {
    const activeParticipant = this.participants.get(participantId);
    if (!activeParticipant || this.destroyed) return;

    switch (message.type) {
      case "audio:start":
        await this.startRecognition(participantId, activeParticipant);
        return;
      case "audio:stop":
        await this.stopRecognition(activeParticipant);
        return;
      case "caption:manual":
        // FALLBACK: typed captions keep the meeting usable while audio processing is unavailable.
        await this.enqueueCaption({
          speaker: activeParticipant.participant,
          sourceLanguage: activeParticipant.participant.speechLanguage,
          sourceText: message.text,
          kind: "manual",
        });
        return;
      case "clarification:request":
        this.requestClarification(activeParticipant.participant, message.captionId);
        return;
      case "leave":
        return;
    }
  }

  writeAudio(participantId: string, chunk: Uint8Array): boolean {
    const attempt = this.participants.get(participantId)?.recognition.attempt;
    if (!attempt?.active || !attempt.session || this.destroyed) return false;
    attempt.session.write(chunk);
    return true;
  }

  async enqueueCaption(input: {
    speaker: Participant;
    sourceLanguage: SpeechLanguage;
    sourceText: string;
    kind: Caption["kind"];
  }): Promise<void> {
    if (this.destroyed) return;

    const caption: Caption = {
      id: crypto.randomUUID(),
      sequence: ++this.sequence,
      speaker: input.speaker,
      sourceLanguage: input.sourceLanguage,
      sourceText: input.sourceText,
      kind: input.kind,
      state: "translating",
      createdAt: Date.now(),
    };
    this.captions.set(caption.id, caption);
    this.broadcastCaption("caption:pending", caption);

    this.translationQueue.enqueue({
      getRequest: () => ({
        sourceText: caption.sourceText,
        sourceLanguage: caption.sourceLanguage,
        targetLanguage: this.oppositeLanguage(caption.sourceLanguage),
        context: this.context.slice(),
        glossary: this.dependencies.glossary ?? [],
      }),
      onTranslated: (translatedText) => {
        if (this.destroyed) return;
        caption.translatedText = translatedText;
        caption.state = "final";
        this.context.push(caption);
        if (this.context.length > MAX_CONTEXT_CAPTIONS) this.context.shift();
        this.broadcastCaption("caption:final", caption);
      },
      onFailed: () => {
        if (this.destroyed) return;
        caption.state = "failed";
        this.broadcastCaption("caption:failed", caption);
        this.broadcast({ type: "status", code: "translation_unavailable" });
      },
    });
  }

  destroy(): Promise<void> {
    if (this.destroying) return this.destroying;
    this.destroyed = true;
    const stops = [...this.participantLifecycles].map((activeParticipant) =>
      this.stopRecognition(activeParticipant),
    );
    this.participants.clear();
    this.captions.clear();
    this.context.length = 0;
    this.translationQueue.clear();
    this.destroying = Promise.all(stops).then(() => { this.participantLifecycles.clear(); });
    return this.destroying;
  }

  private matchesJoinToken(message: Extract<ClientMessage, { type: "join" }>): boolean {
    if (
      message.roomId !== this.dependencies.roomId ||
      message.consent !== true ||
      typeof message.token !== "string" ||
      typeof message.displayName !== "string" ||
      typeof message.speechLanguage !== "string" ||
      typeof message.displayLanguage !== "string"
    ) {
      return false;
    }

    const candidateHash = createHash("sha256").update(message.token).digest();
    return (
      candidateHash.length === this.dependencies.joinTokenHash.length &&
      timingSafeEqual(candidateHash, this.dependencies.joinTokenHash)
    );
  }

  private startRecognition(
    participantId: string,
    activeParticipant: ActiveParticipant,
  ): Promise<void> {
    const lifecycle = activeParticipant.recognition;
    if (lifecycle.startRequest?.generation === lifecycle.generation) return lifecycle.startRequest.completion;
    if (lifecycle.attempt?.active) return lifecycle.completion;

    const request = { generation: lifecycle.generation, completion: Promise.resolve() };
    request.completion = lifecycle.completion.then(async () => {
      try {
        if (request.generation !== lifecycle.generation || this.destroyed || !this.participants.has(participantId)) return;
        const attempt: RecognitionAttempt = { active: true };
        lifecycle.attempt = attempt;
        await this.startRecognitionSession(activeParticipant, attempt);
      } finally {
        if (lifecycle.startRequest === request) lifecycle.startRequest = undefined;
      }
    });
    lifecycle.startRequest = request;
    lifecycle.completion = request.completion;
    return request.completion;
  }

  private async startRecognitionSession(
    activeParticipant: ActiveParticipant,
    attempt: RecognitionAttempt,
  ): Promise<void> {
    try {
      attempt.session = await this.dependencies.recognizer.start({
        language: activeParticipant.participant.speechLanguage,
        onPartial: (text) => {
          if (attempt.active && !this.destroyed) {
            activeParticipant.connection.send({
              type: "caption:preview",
              speakerId: activeParticipant.participant.id,
              sourceText: text,
            });
          }
        },
        onFinal: (text) => {
          void this.enqueueCaption({
            speaker: activeParticipant.participant,
            sourceLanguage: activeParticipant.participant.speechLanguage,
            sourceText: text,
            kind: "speech",
          });
        },
        onError: () => {
          if (!attempt.active) return;
          void this.stopRecognition(activeParticipant);
          this.broadcast({ type: "status", code: "recognition_unavailable" });
        },
      });

      if (!attempt.active) await this.stopRecognitionSession(attempt);
    } catch {
      attempt.active = false;
      this.broadcast({ type: "status", code: "recognition_unavailable" });
    }
  }

  private stopRecognition(activeParticipant: ActiveParticipant): Promise<void> {
    const lifecycle = activeParticipant.recognition;
    lifecycle.generation += 1;
    lifecycle.startRequest = undefined;
    const attempt = lifecycle.attempt;
    if (attempt) attempt.active = false;
    const stop = attempt ? this.stopRecognitionSession(attempt) : Promise.resolve();
    lifecycle.completion = Promise.all([lifecycle.completion, stop]).then(async () => {
      if (attempt) await this.stopRecognitionSession(attempt);
    });
    return lifecycle.completion;
  }

  private stopRecognitionSession(
    attempt: RecognitionAttempt,
  ): Promise<void> {
    if (attempt.stopping) return attempt.stopping;
    if (!attempt.session) return Promise.resolve();

    let stopPromise: Promise<void>;
    try {
      stopPromise = attempt.session.stop();
    } catch {
      // SILENT: recognition failures use stable status codes instead of provider error details.
      stopPromise = Promise.resolve();
    }

    attempt.stopping = stopPromise.catch(() => {
      // SILENT: recognition failures use stable status codes instead of provider error details.
    });
    return attempt.stopping;
  }

  private requestClarification(requester: Participant, captionId: string): void {
    const caption = this.captions.get(captionId);
    if (!caption) return;
    this.participants
      .get(caption.speaker.id)
      ?.connection.send({ type: "clarification:requested", captionId, requester });
  }

  private oppositeLanguage(language: SpeechLanguage): SpeechLanguage {
    return language === "ja-JP" ? "en-US" : "ja-JP";
  }

  private broadcast(message: Parameters<RoomConnection["send"]>[0], excludedParticipantId?: string): void {
    for (const [participantId, { connection }] of this.participants) {
      if (participantId !== excludedParticipantId) connection.send(message);
    }
  }

  private broadcastCaption(type: "caption:pending" | "caption:final" | "caption:failed", caption: Caption): void {
    this.broadcast({ type, caption: { ...caption } });
  }
}
