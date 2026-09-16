import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";
import type WebSocket from "ws";

import type { RecognitionOptions, RecognitionSession, SpeechRecognizer, Translator } from "../adapters/contracts.js";
import { createApp } from "../app.js";
import type { ServiceConfig } from "../config.js";
import { RoomRegistry } from "../room/room-registry.js";
import type { ServerMessage } from "../../shared/meeting.js";

class FakeTranslator implements Translator {
  async translate(): Promise<string> {
    return "translated";
  }
}

class FakeRecognizer implements SpeechRecognizer {
  readonly sessions: Array<{ writes: Uint8Array[]; stopped: boolean }> = [];

  async start(_options: RecognitionOptions): Promise<RecognitionSession> {
    const session: { writes: Uint8Array[]; stopped: boolean } = { writes: [], stopped: false };
    this.sessions.push(session);
    return {
      write: (chunk) => session.writes.push(chunk),
      stop: async () => {
        session.stopped = true;
      },
    };
  }
}

class DelayedStopRecognizer extends FakeRecognizer {
  private stopResolver?: () => void;

  override async start(_options: RecognitionOptions): Promise<RecognitionSession> {
    const session: { writes: Uint8Array[]; stopped: boolean } = { writes: [], stopped: false };
    this.sessions.push(session);
    return {
      write: (chunk) => session.writes.push(chunk),
      stop: () => {
        session.stopped = true;
        return new Promise<void>((resolve) => { this.stopResolver = resolve; });
      },
    };
  }

  finishStop(): void {
    if (!this.stopResolver) throw new Error("recognition stop was not pending");
    this.stopResolver();
  }
}

const config: ServiceConfig = {
  awsRegion: "ap-northeast-1",
  bedrockModelId: "test-model",
  basePath: "/translate",
  glossary: [],
};

const nextMessage = (socket: WebSocket): Promise<ServerMessage> => new Promise((resolve) => {
  socket.once("message", (data, isBinary) => {
    if (isBinary) throw new Error("server sent a binary protocol message");
    resolve(JSON.parse(data.toString()) as ServerMessage);
  });
});

const nextBrowserMessage = (socket: globalThis.WebSocket): Promise<ServerMessage> => new Promise((resolve) => {
  socket.addEventListener("message", (event) => {
    resolve(JSON.parse(String(event.data)) as ServerMessage);
  }, { once: true });
});

const waitFor = async (predicate: () => boolean): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error("timed out waiting for transport effect");
};

const nextEvent = (target: EventTarget, type: string): Promise<Event> => new Promise((resolve) => {
  target.addEventListener(type, resolve, { once: true });
});

const apps: Array<{ app: ReturnType<typeof createApp>; registry: RoomRegistry }> = [];

const createTestApp = async (recognizer: FakeRecognizer = new FakeRecognizer()) => {
  const publicDir = await mkdtemp(join(tmpdir(), "meeting-translation-public-"));
  await writeFile(join(publicDir, "index.html"), "<main>meeting translation</main>");
  const registry = new RoomRegistry({ translator: new FakeTranslator(), recognizer });
  const app = createApp({ config, registry, publicDir });
  await app.ready();
  apps.push({ app, registry });
  return { app, recognizer, registry };
};

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async ({ app, registry }) => {
    await app.close();
    await registry.destroyAll();
  }));
});

describe("meeting WebSocket route", () => {
  it("normalizes WebSocket errors before writing structured logs", async () => {
    const logLines: string[] = [];
    const write = vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      logLines.push(String(chunk));
      return true;
    });

    try {
      const { app } = await createTestApp();
      await app.injectWS("/translate/ws");
      const serverSocket = [...app.websocketServer.clients][0];
      if (!serverSocket) throw new Error("test WebSocket was not registered");
      serverSocket.emit("error", new Error("join-token transcript binary-audio"));

      const logs = logLines.map((line) => JSON.parse(line) as Record<string, unknown>);
      expect(JSON.stringify(logs)).not.toContain("join-token transcript binary-audio");
      for (const log of logs) {
        expect(Object.keys(log).sort()).toEqual(["eventCode", "level", "time"]);
      }
    } finally {
      write.mockRestore();
    }
  });

  it("joins with a fragment-supplied token that never appears in an HTTP URL", async () => {
    const { app } = await createTestApp();
    const created = await app.inject({ method: "POST", url: "/translate/api/rooms" });
    const { roomId, joinToken } = created.json<{ roomId: string; joinToken: string }>();
    const socket = await app.injectWS("/translate/ws");
    const joined = nextMessage(socket);

    socket.send(JSON.stringify({
      type: "join",
      roomId,
      token: joinToken,
      displayName: "Ken",
      speechLanguage: "ja-JP",
      displayLanguage: "ja",
      consent: true,
    }));

    await expect(joined).resolves.toMatchObject({ type: "room:joined", participants: [{ displayName: "Ken" }] });
    expect(created.headers.location).toBeUndefined();
    socket.close();
    await once(socket, "close");
  });

  it("accepts a join frame sent during WebSocket open", async () => {
    const { app } = await createTestApp();
    const created = await app.inject({ method: "POST", url: "/translate/api/rooms" });
    const { roomId, joinToken } = created.json<{ roomId: string; joinToken: string }>();
    const socket = await app.injectWS("/translate/ws", {}, {
      onOpen: (opened) => {
        opened.send(JSON.stringify({
          type: "join", roomId, token: joinToken, displayName: "Ken", speechLanguage: "ja-JP", displayLanguage: "ja", consent: true,
        }));
      },
    });

    await expect(nextMessage(socket)).resolves.toMatchObject({ type: "room:joined", participants: [{ displayName: "Ken" }] });
    socket.close();
    await once(socket, "close");
  });

  it("returns stable invalid_message statuses for malformed text and inactive audio", async () => {
    const { app } = await createTestApp();
    const socket = await app.injectWS("/translate/ws");

    const malformed = nextMessage(socket);
    socket.send("not JSON");
    await expect(malformed).resolves.toEqual({ type: "status", code: "invalid_message" });

    const inactiveAudio = nextMessage(socket);
    socket.send(Buffer.from([1, 2, 3]), { binary: true });
    await expect(inactiveAudio).resolves.toEqual({ type: "status", code: "invalid_message" });
    socket.close();
    await once(socket, "close");
  });

  it("closes an actual WebSocket when one frame exceeds 64 KiB", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);

    try {
      const { app } = await createTestApp();
      await app.listen({ port: 0, host: "127.0.0.1" });
      const address = app.server.address() as AddressInfo;
      const socket = new globalThis.WebSocket(`ws://127.0.0.1:${address.port}/translate/ws`);
      await nextEvent(socket, "open");
      const closed = nextEvent(socket, "close");

      socket.send(new Uint8Array(64 * 1_024 + 1));

      expect((await closed as CloseEvent).code).toBe(1009);
    } finally {
      write.mockRestore();
    }
  });

  it("forwards binary PCM only after the joined participant starts recognition", async () => {
    const { app, recognizer } = await createTestApp();
    const created = await app.inject({ method: "POST", url: "/translate/api/rooms" });
    const { roomId, joinToken } = created.json<{ roomId: string; joinToken: string }>();
    const socket = await app.injectWS("/translate/ws");
    const joined = nextMessage(socket);
    socket.send(JSON.stringify({
      type: "join", roomId, token: joinToken, displayName: "Ken", speechLanguage: "ja-JP", displayLanguage: "ja", consent: true,
    }));
    await joined;

    socket.send(JSON.stringify({ type: "audio:start" }));
    await waitFor(() => recognizer.sessions.length === 1);
    socket.send(Buffer.from([1, 2, 3]), { binary: true });
    await waitFor(() => recognizer.sessions[0]?.writes.length === 1);

    expect([...recognizer.sessions[0]!.writes[0]!]).toEqual([1, 2, 3]);
    socket.close();
    await once(socket, "close");
  });

  it("stops recognition, reconnects during grace, and receives captions from the new connection", async () => {
    const { app, recognizer } = await createTestApp();
    const created = await app.inject({ method: "POST", url: "/translate/api/rooms" });
    const { roomId, joinToken } = created.json<{ roomId: string; joinToken: string }>();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address() as AddressInfo;
    const socket = new globalThis.WebSocket(`ws://127.0.0.1:${address.port}/translate/ws`);
    await nextEvent(socket, "open");
    const joined = nextBrowserMessage(socket);
    socket.send(JSON.stringify({
      type: "join", roomId, token: joinToken, displayName: "Ken", speechLanguage: "ja-JP", displayLanguage: "ja", consent: true,
    }));
    await joined;
    socket.send(JSON.stringify({ type: "audio:start" }));
    await waitFor(() => recognizer.sessions.length === 1);

    socket.close();
    await nextEvent(socket, "close");
    await waitFor(() => recognizer.sessions[0]?.stopped === true);

    const reconnect = await app.injectWS("/translate/ws");
    const rejoined = nextMessage(reconnect);
    reconnect.send(JSON.stringify({
      type: "join", roomId, token: joinToken, displayName: "Ken", speechLanguage: "ja-JP", displayLanguage: "ja", consent: true,
    }));
    await expect(rejoined).resolves.toMatchObject({
      type: "room:joined",
      participants: [{ displayName: "Ken" }],
    });

    const caption = nextMessage(reconnect);
    reconnect.send(JSON.stringify({ type: "caption:manual", text: "再接続後" }));
    await expect(caption).resolves.toMatchObject({
      type: "caption:pending",
      caption: { sourceText: "再接続後" },
    });

    const reconnectClosed = once(reconnect, "close");
    reconnect.send(JSON.stringify({ type: "leave" }));
    reconnect.close();
    await reconnectClosed;
    const afterLeave = await app.injectWS("/translate/ws");
    const roomMissing = nextMessage(afterLeave);
    afterLeave.send(JSON.stringify({
      type: "join", roomId, token: joinToken, displayName: "Ken", speechLanguage: "ja-JP", displayLanguage: "ja", consent: true,
    }));
    await expect(roomMissing).resolves.toEqual({ type: "status", code: "room_not_found" });

    afterLeave.close();
    await once(afterLeave, "close");
  });

  it("keeps explicit leave immediate while an earlier audio stop is pending", async () => {
    const recognizer = new DelayedStopRecognizer();
    const { app } = await createTestApp(recognizer);
    const created = await app.inject({ method: "POST", url: "/translate/api/rooms" });
    const { roomId, joinToken } = created.json<{ roomId: string; joinToken: string }>();
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address() as AddressInfo;
    const socket = new globalThis.WebSocket(`ws://127.0.0.1:${address.port}/translate/ws`);
    await nextEvent(socket, "open");
    const joined = nextBrowserMessage(socket);
    socket.send(JSON.stringify({
      type: "join", roomId, token: joinToken, displayName: "Ken", speechLanguage: "ja-JP", displayLanguage: "ja", consent: true,
    }));
    await joined;
    socket.send(JSON.stringify({ type: "audio:start" }));
    await waitFor(() => recognizer.sessions.length === 1);

    socket.send(JSON.stringify({ type: "audio:stop" }));
    await waitFor(() => recognizer.sessions[0]?.stopped === true);
    const serverSocket = [...app.websocketServer.clients][0];
    if (!serverSocket) throw new Error("test WebSocket was not registered");
    const leaveReceived = once(serverSocket, "message");
    socket.send(JSON.stringify({ type: "leave" }));
    await leaveReceived;
    const closed = nextEvent(socket, "close");
    const serverClosed = once(serverSocket, "close");
    socket.close();
    await Promise.all([closed, serverClosed]);

    const afterLeave = await app.injectWS("/translate/ws");
    const response = nextMessage(afterLeave);
    afterLeave.send(JSON.stringify({
      type: "join", roomId, token: joinToken, displayName: "Ken", speechLanguage: "ja-JP", displayLanguage: "ja", consent: true,
    }));
    const rejoinResult = await response;
    recognizer.finishStop();

    expect(rejoinResult).toEqual({ type: "status", code: "room_not_found" });
    afterLeave.close();
    await once(afterLeave, "close");
  });
});
