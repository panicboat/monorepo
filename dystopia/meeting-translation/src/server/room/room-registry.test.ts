import { describe, expect, it } from "vitest";

import type {
  RecognitionOptions,
  RecognitionSession,
  RoomConnection,
  SpeechRecognizer,
  Translator,
} from "../adapters/contracts.js";
import type { ClientMessage, ServerMessage } from "../../shared/meeting.js";
import { RoomCreationLimiter } from "./room-creation-limiter.js";
import { RoomRegistry } from "./room-registry.js";

class RecordingConnection implements RoomConnection {
  readonly messages: ServerMessage[] = [];

  send(message: ServerMessage): void {
    this.messages.push(message);
  }
}

class DeferredTranslator implements Translator {
  async translate(): Promise<string> {
    return "translated";
  }
}

class FakeRecognizer implements SpeechRecognizer {
  readonly sessions: Array<{ options: RecognitionOptions; stopped: boolean }> = [];

  async start(options: RecognitionOptions): Promise<RecognitionSession> {
    const session = { options, stopped: false };
    this.sessions.push(session);
    return {
      write: () => undefined,
      stop: async () => {
        session.stopped = true;
      },
    };
  }
}

const joinMessage = (
  roomId: string,
  token: string,
  displayName: string,
): ClientMessage => ({
  type: "join",
  roomId,
  token,
  displayName,
  speechLanguage: "ja-JP",
  displayLanguage: "ja",
  consent: true,
});

describe("RoomRegistry", () => {
  it("allows five room creations per IP address in a ten-minute window", () => {
    const limiter = new RoomCreationLimiter();

    expect([1, 2, 3, 4, 5].every(() => limiter.allow("192.0.2.1"))).toBe(true);
    expect(limiter.allow("192.0.2.1")).toBe(false);
    expect(limiter.allow("192.0.2.2")).toBe(true);
  });

  it("accepts three participants and rejects a fourth", () => {
    const registry = new RoomRegistry({
      translator: new DeferredTranslator(),
      recognizer: new FakeRecognizer(),
    });
    const created = registry.create();

    expect(registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "A")).ok).toBe(
      true,
    );
    expect(registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "B")).ok).toBe(
      true,
    );
    expect(registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "C")).ok).toBe(
      true,
    );
    expect(
      registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "D")),
    ).toEqual({ ok: false, code: "room_full" });
  });

  it("rejects a join whose token does not match the room secret", () => {
    const registry = new RoomRegistry({
      translator: new DeferredTranslator(),
      recognizer: new FakeRecognizer(),
    });
    const created = registry.create();

    expect(registry.join(new RecordingConnection(), joinMessage(created.roomId, "wrong-token", "A"))).toEqual({
      ok: false,
      code: "room_not_found",
    });
  });

  it("rejects a join without explicit consent", () => {
    const registry = new RoomRegistry({
      translator: new DeferredTranslator(),
      recognizer: new FakeRecognizer(),
    });
    const created = registry.create();

    expect(
      registry.join(new RecordingConnection(), {
        ...joinMessage(created.roomId, created.joinToken, "A"),
        consent: false,
      } as never),
    ).toEqual({ ok: false, code: "invalid_message" });
  });

  it("removes a disconnected participant and deletes the room after the final participant leaves", async () => {
    const registry = new RoomRegistry({
      translator: new DeferredTranslator(),
      recognizer: new FakeRecognizer(),
    });
    const created = registry.create();
    const firstConnection = new RecordingConnection();
    const secondConnection = new RecordingConnection();
    const first = registry.join(firstConnection, joinMessage(created.roomId, created.joinToken, "A"));
    const second = registry.join(secondConnection, joinMessage(created.roomId, created.joinToken, "B"));

    if (!first.ok || !second.ok) throw new Error("test participants did not join");

    await registry.disconnect(first.participant.id);

    expect(secondConnection.messages).toContainEqual({
      type: "participant:left",
      participant: first.participant,
    });
    const third = registry.join(
      new RecordingConnection(),
      joinMessage(created.roomId, created.joinToken, "C"),
    );

    if (!third.ok) throw new Error("replacement participant did not join");

    await registry.disconnect(second.participant.id);
    await registry.disconnect(third.participant.id);

    expect(registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "E"))).toEqual({
      ok: false,
      code: "room_not_found",
    });
  });

  it("stops recognition when audio stops", async () => {
    const recognizer = new FakeRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const joined = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "audio:start" });
    await registry.handle(joined.participant.id, { type: "audio:stop" });

    expect(recognizer.sessions).toHaveLength(1);
    expect(recognizer.sessions[0]?.stopped).toBe(true);
  });
});
