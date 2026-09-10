import { describe, expect, it } from "vitest";

import type {
  RecognitionOptions,
  RecognitionSession,
  RoomConnection,
  SpeechRecognizer,
  TranslationRequest,
  Translator,
} from "../adapters/contracts.js";
import type { Caption, ClientMessage, ServerMessage } from "../../shared/meeting.js";
import { RoomRegistry } from "./room-registry.js";

class RecordingConnection implements RoomConnection {
  readonly messages: ServerMessage[] = [];

  send(message: ServerMessage): void {
    this.messages.push(message);
  }
}

class DeferredTranslator implements Translator {
  readonly requests: TranslationRequest[] = [];
  private readonly pending: Array<{ resolve: (text: string) => void; reject: () => void }> = [];

  translate(request: TranslationRequest): Promise<string> {
    this.requests.push(request);
    return new Promise((resolve, reject) => {
      this.pending.push({ resolve, reject: () => reject(new Error("translation unavailable")) });
    });
  }

  async resolveInRequestOrder(...translations: string[]): Promise<void> {
    for (const translation of translations) {
      await Promise.resolve();
      const pending = this.pending.shift();
      if (!pending) throw new Error("translation request was not pending");
      pending.resolve(translation);
      await Promise.resolve();
    }
  }

  async rejectNext(): Promise<void> {
    await Promise.resolve();
    const pending = this.pending.shift();
    if (!pending) throw new Error("translation request was not pending");
    pending.reject();
    await Promise.resolve();
  }
}

class FakeRecognizer implements SpeechRecognizer {
  readonly sessions: RecognitionOptions[] = [];

  async start(options: RecognitionOptions): Promise<RecognitionSession> {
    this.sessions.push(options);
    return { write: () => undefined, stop: async () => undefined };
  }

  emitFinal(session: number, text: string): void {
    this.sessions[session]?.onFinal(text);
  }
}

const captions = (connection: RecordingConnection): Caption[] =>
  connection.messages
    .filter(
      (message): message is Extract<ServerMessage, { type: "caption:pending" | "caption:final" | "caption:failed" }> =>
        message.type === "caption:pending" || message.type === "caption:final" || message.type === "caption:failed",
    )
    .map((message) => message.caption);

const joinMessage = (
  roomId: string,
  token: string,
  displayName: string,
  speechLanguage: "ja-JP" | "en-US",
): ClientMessage => ({
  type: "join",
  roomId,
  token,
  displayName,
  speechLanguage,
  displayLanguage: speechLanguage === "ja-JP" ? "ja" : "en",
  consent: true,
});

describe("MeetingRoom", () => {
  it("keeps a later completed translation after an earlier pending caption", async () => {
    const translator = new DeferredTranslator();
    const recognizer = new FakeRecognizer();
    const registry = new RoomRegistry({ translator, recognizer });
    const created = registry.create();
    const connection = new RecordingConnection();
    const first = registry.join(connection, joinMessage(created.roomId, created.joinToken, "A", "ja-JP"));
    const second = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "B", "en-US"));

    if (!first.ok || !second.ok) throw new Error("test participants did not join");

    await registry.handle(first.participant.id, { type: "audio:start" });
    await registry.handle(second.participant.id, { type: "audio:start" });
    recognizer.emitFinal(0, "最初の発話");
    recognizer.emitFinal(1, "second utterance");

    await translator.resolveInRequestOrder("first translation", "second translation");

    expect(captions(connection).filter((caption) => caption.state === "final")).toMatchObject([
      { sequence: 1, state: "final", translatedText: "first translation" },
      { sequence: 2, state: "final", translatedText: "second translation" },
    ]);
  });

  it("builds a later translation request with the earlier final caption as context", async () => {
    const translator = new DeferredTranslator();
    const registry = new RoomRegistry({ translator, recognizer: new FakeRecognizer() });
    const created = registry.create();
    const joined = registry.join(
      new RecordingConnection(),
      joinMessage(created.roomId, created.joinToken, "A", "ja-JP"),
    );

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "caption:manual", text: "最初の発話" });
    await registry.handle(joined.participant.id, { type: "caption:manual", text: "次の発話" });
    await translator.resolveInRequestOrder("first translation", "second translation");

    expect(translator.requests[1]?.context).toMatchObject([
      {
        sourceText: "最初の発話",
        translatedText: "first translation",
        state: "final",
      },
    ]);
  });

  it("keeps only the latest twelve final captions in a later translation request", async () => {
    const translator = new DeferredTranslator();
    const registry = new RoomRegistry({ translator, recognizer: new FakeRecognizer() });
    const created = registry.create();
    const joined = registry.join(
      new RecordingConnection(),
      joinMessage(created.roomId, created.joinToken, "A", "ja-JP"),
    );

    if (!joined.ok) throw new Error("test participant did not join");

    const sourceTexts = Array.from({ length: 14 }, (_, index) => `発話 ${index + 1}`);
    for (const sourceText of sourceTexts) {
      await registry.handle(joined.participant.id, { type: "caption:manual", text: sourceText });
    }
    await translator.resolveInRequestOrder(...sourceTexts.map((sourceText) => `${sourceText} translation`));

    expect(translator.requests[13]?.context.map((caption) => caption.sequence)).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it("sends recognition previews only to the speaker", async () => {
    const translator = new DeferredTranslator();
    const recognizer = new FakeRecognizer();
    const registry = new RoomRegistry({ translator, recognizer });
    const created = registry.create();
    const speakerConnection = new RecordingConnection();
    const listenerConnection = new RecordingConnection();
    const speaker = registry.join(speakerConnection, joinMessage(created.roomId, created.joinToken, "A", "ja-JP"));
    registry.join(listenerConnection, joinMessage(created.roomId, created.joinToken, "B", "en-US"));
    if (!speaker.ok) throw new Error("test participant did not join");

    await registry.handle(speaker.participant.id, { type: "audio:start" });
    recognizer.sessions[0]?.onPartial("未確定の発話");

    expect(speakerConnection.messages).toContainEqual({
      type: "caption:preview", speakerId: speaker.participant.id, sourceText: "未確定の発話",
    });
    expect(listenerConnection.messages.filter((message) => message.type === "caption:preview")).toEqual([]);
    expect(translator.requests).toEqual([]);
  });

  it("keeps manual source text when translation rejects", async () => {
    const translator = new DeferredTranslator();
    const registry = new RoomRegistry({ translator, recognizer: new FakeRecognizer() });
    const created = registry.create();
    const connection = new RecordingConnection();
    const joined = registry.join(connection, joinMessage(created.roomId, created.joinToken, "A", "ja-JP"));

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "caption:manual", text: "入力した発話" });
    await translator.rejectNext();

    expect(captions(connection).at(-1)).toMatchObject({
      sourceText: "入力した発話",
      kind: "manual",
      state: "failed",
    });
    expect(connection.messages).toContainEqual({ type: "status", code: "translation_unavailable" });
  });

  it("sends clarification requests only to the original speaker", async () => {
    const translator = new DeferredTranslator();
    const registry = new RoomRegistry({ translator, recognizer: new FakeRecognizer() });
    const created = registry.create();
    const speakerConnection = new RecordingConnection();
    const requesterConnection = new RecordingConnection();
    const speaker = registry.join(
      speakerConnection,
      joinMessage(created.roomId, created.joinToken, "A", "ja-JP"),
    );
    const requester = registry.join(
      requesterConnection,
      joinMessage(created.roomId, created.joinToken, "B", "en-US"),
    );

    if (!speaker.ok || !requester.ok) throw new Error("test participants did not join");

    await registry.handle(speaker.participant.id, { type: "caption:manual", text: "確認対象" });
    const captionId = captions(speakerConnection).at(-1)?.id;
    if (!captionId) throw new Error("caption was not broadcast");

    await registry.handle(requester.participant.id, { type: "clarification:request", captionId });

    expect(speakerConnection.messages).toContainEqual({
      type: "clarification:requested",
      captionId,
      requester: requester.participant,
    });
    expect(requesterConnection.messages).not.toContainEqual(
      expect.objectContaining({ type: "clarification:requested", captionId }),
    );
  });
});
