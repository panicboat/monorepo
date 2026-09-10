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
  private rejectStart = false;

  rejectNextStart(): void {
    this.rejectStart = true;
  }

  async start(options: RecognitionOptions): Promise<RecognitionSession> {
    if (this.rejectStart) {
      this.rejectStart = false;
      throw new Error("recognition unavailable");
    }

    const session = { options, stopped: false };
    this.sessions.push(session);
    return {
      write: () => undefined,
      stop: async () => {
        session.stopped = true;
      },
    };
  }

  emitError(session: number): void {
    this.sessions[session]?.options.onError("recognition_unavailable");
  }
}

class DelayedStopRecognizer implements SpeechRecognizer {
  readonly sessions: Array<{ options: RecognitionOptions; stopped: boolean }> = [];
  private readonly stopResolvers: Array<() => void> = [];
  private readonly stopRejectors: Array<(reason: Error) => void> = [];

  async start(options: RecognitionOptions): Promise<RecognitionSession> {
    const session = { options, stopped: false };
    this.sessions.push(session);
    return {
      write: () => undefined,
      stop: () => {
        session.stopped = true;
        return new Promise((resolve, reject) => {
          this.stopResolvers.push(resolve);
          this.stopRejectors.push(reject);
        });
      },
    };
  }

  emitError(session: number): void {
    this.sessions[session]?.options.onError("recognition_unavailable");
  }

  finishStop(session: number): void {
    const resolve = this.stopResolvers[session];
    if (!resolve) throw new Error("recognition stop was not pending");
    resolve();
  }

  rejectStop(session: number): void {
    const reject = this.stopRejectors[session];
    if (!reject) throw new Error("recognition stop was not pending");
    reject(new Error("provider stop failure"));
  }
}

class DelayedStartStopRecognizer implements SpeechRecognizer {
  readonly starts: RecognitionOptions[] = [];
  readonly sessions: Array<{ stopped: boolean }> = [];
  private readonly startResolvers: Array<(session: RecognitionSession) => void> = [];
  private readonly startRejectors: Array<(reason: Error) => void> = [];
  private readonly stopResolvers: Array<() => void> = [];
  private readonly stopRejectors: Array<(reason: Error) => void> = [];

  start(options: RecognitionOptions): Promise<RecognitionSession> {
    this.starts.push(options);
    return new Promise((resolve, reject) => {
      this.startResolvers.push(resolve);
      this.startRejectors.push(reject);
    });
  }

  emitError(start: number): void {
    this.starts[start]?.onError("recognition_unavailable");
  }

  finishStart(start: number): void {
    const resolve = this.startResolvers[start];
    if (!resolve) throw new Error("recognition start was not pending");

    const session = { stopped: false };
    this.sessions.push(session);
    resolve({
      write: () => undefined,
      stop: () => {
        session.stopped = true;
        return new Promise((stopResolve, stopReject) => {
          this.stopResolvers.push(stopResolve);
          this.stopRejectors.push(stopReject);
        });
      },
    });
  }

  finishStop(stop: number): void {
    const resolve = this.stopResolvers[stop];
    if (!resolve) throw new Error("recognition stop was not pending");
    resolve();
  }

  rejectStart(start: number): void {
    const reject = this.startRejectors[start];
    if (!reject) throw new Error("recognition start was not pending");
    reject(new Error("private provider start failure"));
  }

  rejectStop(stop: number): void {
    const reject = this.stopRejectors[stop];
    if (!reject) throw new Error("recognition stop was not pending");
    reject(new Error("private provider stop failure"));
  }
}

const flushOperations = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const observeCompletion = (promise: Promise<void>) => {
  const result = { completed: false, promise: Promise.resolve() };
  result.promise = promise.then(() => { result.completed = true; });
  return result;
};

const createDelayedRoom = () => {
  const recognizer = new DelayedStartStopRecognizer();
  const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
  const created = registry.create();
  const connection = new RecordingConnection();
  const joined = registry.join(connection, joinMessage(created.roomId, created.joinToken, "A"));
  if (!joined.ok) throw new Error("test participant did not join");
  return { recognizer, registry, created, connection, participantId: joined.participant.id };
};

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
  it.each(["resolve", "reject"] as const)("coalesces restarts while the previous stop will %s", async (outcome) => {
    const { recognizer, registry, participantId } = createDelayedRoom();
    const start = registry.handle(participantId, { type: "audio:start" });
    await flushOperations();
    recognizer.finishStart(0);
    await start;
    recognizer.emitError(0);
    const restarts = [1, 2, 3].map(() => observeCompletion(registry.handle(participantId, { type: "audio:start" })));
    await flushOperations();
    expect(recognizer.starts).toHaveLength(1);
    if (outcome === "resolve") recognizer.finishStop(0);
    else recognizer.rejectStop(0);
    await flushOperations();

    expect(recognizer.starts).toHaveLength(2);
    expect(restarts.map((restart) => restart.completed)).toEqual([false, false, false]);
    recognizer.finishStart(1);
    await Promise.all(restarts.map((restart) => restart.promise));
    expect(registry.writeAudio(participantId, new Uint8Array([1]))).toBe(true);
  });

  it("cancels a queued restart when a later audio stop arrives", async () => {
    const { recognizer, registry, participantId } = createDelayedRoom();
    const start = registry.handle(participantId, { type: "audio:start" });
    await flushOperations();
    recognizer.finishStart(0);
    await start;
    recognizer.emitError(0);
    const restart = observeCompletion(registry.handle(participantId, { type: "audio:start" }));
    const stop = observeCompletion(registry.handle(participantId, { type: "audio:stop" }));
    await flushOperations();
    recognizer.finishStop(0);
    await flushOperations();

    expect(recognizer.starts).toHaveLength(1);
    await Promise.all([restart.promise, stop.promise]);
    expect(registry.writeAudio(participantId, new Uint8Array([1]))).toBe(false);
  });

  for (const phase of ["starting", "active", "stopping"] as const) {
    for (const operation of ["audio:stop", "disconnect", "destroyAll"] as const) {
      it.each(["resolve", "reject"] as const)(`awaits ${phase} recognition cleanup on ${operation} when stop will %s`, async (outcome) => {
        const { recognizer, registry, participantId } = createDelayedRoom();
        const start = registry.handle(participantId, { type: "audio:start" });
        await flushOperations();
        if (phase !== "starting") {
          recognizer.finishStart(0);
          await start;
        }
        if (phase === "stopping") recognizer.emitError(0);
        const cleanup = observeCompletion(operation === "audio:stop"
          ? registry.handle(participantId, { type: "audio:stop" })
          : operation === "disconnect" ? registry.disconnect(participantId) : registry.destroyAll());
        await flushOperations();
        expect(cleanup.completed).toBe(false);
        if (phase === "starting") recognizer.finishStart(0);
        await flushOperations();
        expect(cleanup.completed).toBe(false);
        expect(recognizer.sessions[0]?.stopped).toBe(true);
        expect(registry.writeAudio(participantId, new Uint8Array([1]))).toBe(false);
        if (outcome === "resolve") recognizer.finishStop(0);
        else recognizer.rejectStop(0);
        await Promise.all([start, cleanup.promise]);
        expect(cleanup.completed).toBe(true);
      });
    }
  }

  it("waits for an earlier disconnect when the final participant stops first", async () => {
    const { recognizer, registry, created, participantId } = createDelayedRoom();
    const second = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "B"));
    if (!second.ok) throw new Error("test participant did not join");
    const starts = [participantId, second.participant.id].map((id) => registry.handle(id, { type: "audio:start" }));
    await flushOperations();
    recognizer.finishStart(0);
    recognizer.finishStart(1);
    await Promise.all(starts);
    const firstDisconnect = observeCompletion(registry.disconnect(participantId));
    const lastDisconnect = observeCompletion(registry.disconnect(second.participant.id));
    await flushOperations();
    recognizer.finishStop(1);
    await flushOperations();

    expect(lastDisconnect.completed).toBe(false);
    expect(firstDisconnect.completed).toBe(false);
    recognizer.finishStop(0);
    await Promise.all([firstDisconnect.promise, lastDisconnect.promise]);
    expect(registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "C"))).toEqual({
      ok: false, code: "room_not_found",
    });
  });

  it("includes an exiting participant in concurrent room destruction", async () => {
    const { recognizer, registry, participantId } = createDelayedRoom();
    const start = registry.handle(participantId, { type: "audio:start" });
    await flushOperations();
    const disconnect = registry.disconnect(participantId);
    const destroy = observeCompletion(registry.destroyAll());
    const repeatedDestroy = observeCompletion(registry.destroyAll());
    await flushOperations();
    expect(destroy.completed).toBe(false);
    expect(repeatedDestroy.completed).toBe(false);
    recognizer.finishStart(0);
    await flushOperations();
    expect(recognizer.sessions[0]?.stopped).toBe(true);
    expect(destroy.completed).toBe(false);
    recognizer.rejectStop(0);
    await Promise.all([start, disconnect, destroy.promise, repeatedDestroy.promise]);
  });

  it.each(["audio:stop", "destroyAll"] as const)("settles a rejected start racing with %s without exposing provider errors", async (operation) => {
    const { recognizer, registry, participantId, connection } = createDelayedRoom();
    const start = observeCompletion(registry.handle(participantId, { type: "audio:start" }));
    await flushOperations();
    const cleanup = observeCompletion(operation === "audio:stop"
      ? registry.handle(participantId, { type: "audio:stop" }) : registry.destroyAll());
    await flushOperations();
    expect(cleanup.completed).toBe(false);
    recognizer.rejectStart(0);
    await Promise.all([start.promise, cleanup.promise]);
    expect(registry.writeAudio(participantId, new Uint8Array([1]))).toBe(false);
    expect(JSON.stringify(connection.messages)).not.toContain("private provider");
    if (operation === "audio:stop") {
      expect(connection.messages.filter((message) => message.type === "status")).toEqual([
        { type: "status", code: "recognition_unavailable" },
      ]);
    }
  });

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

  it("reports a recognition start failure and accepts audio after a later start", async () => {
    const recognizer = new FakeRecognizer();
    recognizer.rejectNextStart();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const connection = new RecordingConnection();
    const joined = registry.join(connection, joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "audio:start" });

    expect(connection.messages).toContainEqual({ type: "status", code: "recognition_unavailable" });
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(false);

    await registry.handle(joined.participant.id, { type: "audio:start" });

    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(true);
  });

  it("clears a failed recognition session before a later audio start", async () => {
    const recognizer = new FakeRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const connection = new RecordingConnection();
    const joined = registry.join(connection, joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "audio:start" });
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(true);

    recognizer.emitError(0);

    expect(connection.messages).toContainEqual({ type: "status", code: "recognition_unavailable" });
    expect(recognizer.sessions[0]?.stopped).toBe(true);
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([2]))).toBe(false);

    await registry.handle(joined.participant.id, { type: "audio:start" });

    expect(registry.writeAudio(joined.participant.id, new Uint8Array([3]))).toBe(true);
  });

  it("waits for a failed recognition session to stop before starting another session", async () => {
    const recognizer = new DelayedStopRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const joined = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "audio:start" });
    recognizer.emitError(0);

    let restarted = false;
    const restart = registry.handle(joined.participant.id, { type: "audio:start" }).then(() => {
      restarted = true;
    });
    await Promise.resolve();

    expect(restarted).toBe(false);
    expect(recognizer.sessions).toHaveLength(1);

    recognizer.finishStop(0);
    await restart;

    expect(recognizer.sessions).toHaveLength(2);
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(true);
  });

  it("starts another session after a failed recognition stop rejects", async () => {
    const recognizer = new DelayedStopRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const connection = new RecordingConnection();
    const joined = registry.join(connection, joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "audio:start" });
    recognizer.emitError(0);
    const restart = registry.handle(joined.participant.id, { type: "audio:start" });
    await Promise.resolve();

    expect(recognizer.sessions).toHaveLength(1);

    recognizer.rejectStop(0);
    await restart;

    expect(connection.messages).toContainEqual({ type: "status", code: "recognition_unavailable" });
    expect(recognizer.sessions).toHaveLength(2);
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(true);
  });

  it("waits for a pending failed start and its stop before restarting recognition", async () => {
    const recognizer = new DelayedStartStopRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const joined = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    const firstStart = registry.handle(joined.participant.id, { type: "audio:start" });
    await Promise.resolve();
    recognizer.emitError(0);
    const restart = registry.handle(joined.participant.id, { type: "audio:start" });
    await Promise.resolve();

    expect(recognizer.starts).toHaveLength(1);

    recognizer.finishStart(0);
    await Promise.resolve();

    expect(recognizer.sessions[0]?.stopped).toBe(true);
    expect(recognizer.starts).toHaveLength(1);

    recognizer.finishStop(0);
    await firstStart;
    await flushOperations();

    expect(recognizer.starts).toHaveLength(2);
    recognizer.finishStart(1);
    await restart;
  });

  it("stops a session that resolves after audio stop and permits a later start", async () => {
    const recognizer = new DelayedStartStopRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const joined = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    const firstStart = registry.handle(joined.participant.id, { type: "audio:start" });
    await Promise.resolve();
    const stop = registry.handle(joined.participant.id, { type: "audio:stop" });
    recognizer.finishStart(0);
    await Promise.resolve();

    expect(recognizer.sessions[0]?.stopped).toBe(true);
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(false);

    recognizer.finishStop(0);
    await firstStart;
    await stop;

    const restart = registry.handle(joined.participant.id, { type: "audio:start" });
    await Promise.resolve();
    expect(recognizer.starts).toHaveLength(2);
    recognizer.finishStart(1);
    await restart;

    expect(registry.writeAudio(joined.participant.id, new Uint8Array([2]))).toBe(true);
  });

  it("waits for a pending start session to stop before removing the final participant", async () => {
    const recognizer = new DelayedStartStopRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const joined = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    const start = registry.handle(joined.participant.id, { type: "audio:start" });
    await Promise.resolve();
    let disconnected = false;
    const disconnect = registry.disconnect(joined.participant.id).then(() => {
      disconnected = true;
    });

    recognizer.finishStart(0);
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(disconnected).toBe(false);
    expect(recognizer.sessions[0]?.stopped).toBe(true);
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(false);

    recognizer.finishStop(0);
    await start;
    await disconnect;

    expect(registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "B"))).toEqual({
      ok: false,
      code: "room_not_found",
    });
  });

  it("stops an active session and rejects audio after the final participant disconnects", async () => {
    const recognizer = new FakeRecognizer();
    const registry = new RoomRegistry({ translator: new DeferredTranslator(), recognizer });
    const created = registry.create();
    const joined = registry.join(new RecordingConnection(), joinMessage(created.roomId, created.joinToken, "A"));

    if (!joined.ok) throw new Error("test participant did not join");

    await registry.handle(joined.participant.id, { type: "audio:start" });
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([1]))).toBe(true);

    await registry.disconnect(joined.participant.id);

    expect(recognizer.sessions[0]?.stopped).toBe(true);
    expect(registry.writeAudio(joined.participant.id, new Uint8Array([2]))).toBe(false);
  });
});
