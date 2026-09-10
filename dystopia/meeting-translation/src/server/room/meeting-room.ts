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
  recognitionSession?: RecognitionSession;
  stoppingRecognition?: Promise<void>;
}

export type RoomJoinResult =
  | { ok: true; participant: Participant }
  | { ok: false; code: "invalid_message" | "room_full" | "room_not_found" };

export class MeetingRoom {
  private readonly participants = new Map<string, ActiveParticipant>();
  private readonly captions = new Map<string, Caption>();
  private readonly context: Caption[] = [];
  private readonly translationQueue: TranslationQueue;
  private sequence = 0;
  private destroyed = false;

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
    this.participants.set(participant.id, { participant, connection });

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
    const session = this.participants.get(participantId)?.recognitionSession;
    if (!session || this.destroyed) return false;
    session.write(chunk);
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

  async destroy(): Promise<void> {
    this.destroyed = true;
    const stops = [...this.participants.values()].map((activeParticipant) =>
      this.stopRecognition(activeParticipant),
    );
    this.participants.clear();
    this.captions.clear();
    this.context.length = 0;
    this.translationQueue.clear();
    await Promise.all(stops);
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

  private async startRecognition(
    participantId: string,
    activeParticipant: ActiveParticipant,
  ): Promise<void> {
    if (activeParticipant.recognitionSession) return;
    if (activeParticipant.stoppingRecognition) await activeParticipant.stoppingRecognition;
    if (activeParticipant.recognitionSession || this.destroyed || !this.participants.has(participantId)) return;

    let recognitionSession: RecognitionSession | undefined;
    let recognitionFailed = false;

    try {
      recognitionSession = await this.dependencies.recognizer.start({
        language: activeParticipant.participant.speechLanguage,
        onPartial: (text) => {
          if (!this.destroyed) {
            this.broadcast({
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
          recognitionFailed = true;
          this.failRecognition(activeParticipant, recognitionSession);
        },
      });

      if (recognitionFailed || this.destroyed || !this.participants.has(participantId)) {
        await this.stopRecognitionSession(activeParticipant, recognitionSession);
        return;
      }
      activeParticipant.recognitionSession = recognitionSession;
    } catch {
      activeParticipant.recognitionSession = undefined;
      this.broadcast({ type: "status", code: "recognition_unavailable" });
    }
  }

  private failRecognition(
    activeParticipant: ActiveParticipant,
    recognitionSession: RecognitionSession | undefined,
  ): void {
    if (recognitionSession && activeParticipant.recognitionSession !== recognitionSession) return;

    activeParticipant.recognitionSession = undefined;
    if (recognitionSession) void this.stopRecognitionSession(activeParticipant, recognitionSession);
    this.broadcast({ type: "status", code: "recognition_unavailable" });
  }

  private async stopRecognition(activeParticipant: ActiveParticipant): Promise<void> {
    const recognitionSession = activeParticipant.recognitionSession;
    if (!recognitionSession) {
      if (activeParticipant.stoppingRecognition) await activeParticipant.stoppingRecognition;
      return;
    }
    activeParticipant.recognitionSession = undefined;
    await this.stopRecognitionSession(activeParticipant, recognitionSession);
  }

  private stopRecognitionSession(
    activeParticipant: ActiveParticipant,
    recognitionSession: RecognitionSession,
  ): Promise<void> {
    let stopPromise: Promise<void>;
    try {
      stopPromise = recognitionSession.stop();
    } catch {
      // SILENT: recognition failures use stable status codes instead of provider error details.
      stopPromise = Promise.resolve();
    }

    const stoppingRecognition = stopPromise.catch(() => {
      // SILENT: recognition failures use stable status codes instead of provider error details.
    });
    activeParticipant.stoppingRecognition = stoppingRecognition;
    void stoppingRecognition.then(() => {
      if (activeParticipant.stoppingRecognition === stoppingRecognition) {
        activeParticipant.stoppingRecognition = undefined;
      }
    });
    return stoppingRecognition;
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
