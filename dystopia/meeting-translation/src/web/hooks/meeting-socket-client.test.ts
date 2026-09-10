import { describe, expect, it } from "vitest";

import type { ServerMessage } from "../../shared/meeting.js";
import {
  MeetingSocketClient,
  type MeetingSocketClientDependencies,
  type MeetingWebSocket,
} from "./meeting-socket-client.js";
import type { MeetingJoinDetails, MeetingSocketStatus } from "./use-meeting-socket.js";

class FakeWebSocket implements MeetingWebSocket {
  binaryType: BinaryType = "blob";
  onclose: ((event: CloseEvent) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  readyState = 0;
  readonly sent: Array<string | ArrayBuffer> = [];

  close(): void {
    this.readyState = 3;
  }

  open(): void {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }

  receive(message: ServerMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) } as MessageEvent);
  }

  networkClose(code = 1006): void {
    this.readyState = 3;
    this.onclose?.({ code } as CloseEvent);
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }
}

const join: MeetingJoinDetails = {
  roomId: "room_123",
  token: "token_123",
  displayName: "Ken",
  speechLanguage: "ja-JP",
  displayLanguage: "ja",
};

const roomJoined: ServerMessage = {
  type: "room:joined",
  participantId: "participant_123",
  participants: [],
};

const createHarness = () => {
  const sockets: FakeWebSocket[] = [];
  const statuses: MeetingSocketStatus[] = [];
  const messages: ServerMessage[] = [];
  const timers = new Map<number, { delay: number; run: () => void }>();
  let nextTimerId = 1;
  const dependencies: MeetingSocketClientDependencies = {
    cancelTimer: (timerId) => { timers.delete(timerId); },
    createSocket: () => {
      const socket = new FakeWebSocket();
      sockets.push(socket);
      return socket;
    },
    schedule: (run, delay) => {
      const timerId = nextTimerId;
      nextTimerId += 1;
      timers.set(timerId, { delay, run });
      return timerId;
    },
  };
  const client = new MeetingSocketClient(
    "ws://example.test/translate/ws",
    join,
    dependencies,
    {
      onMessage: (message) => messages.push(message),
      onStatus: (status) => statuses.push(status),
    },
  );
  const runTimer = (expectedDelay: number) => {
    const next = [...timers.entries()][0];
    if (!next) throw new Error("no reconnect timer was scheduled");
    const [timerId, timer] = next;
    expect(timer.delay).toBe(expectedDelay);
    timers.delete(timerId);
    timer.run();
  };
  return { client, messages, runTimer, sockets, statuses };
};

const sentTypes = (socket: FakeWebSocket): string[] => socket.sent
  .filter((data): data is string => typeof data === "string")
  .map((data) => (JSON.parse(data) as { type: string }).type);

describe("MeetingSocketClient", () => {
  it("sends join before one audio start and gates binary frames until room join", () => {
    const harness = createHarness();
    const frame = new ArrayBuffer(4);
    harness.client.start();
    const socket = harness.sockets[0]!;

    socket.open();
    expect(JSON.parse(socket.sent[0] as string)).toEqual({
      type: "join",
      roomId: "room_123",
      token: "token_123",
      displayName: "Ken",
      speechLanguage: "ja-JP",
      displayLanguage: "ja",
      consent: true,
    });
    harness.client.startAudio();
    harness.client.sendAudio(frame);
    expect(sentTypes(socket)).toEqual(["join"]);
    expect(socket.sent).not.toContain(frame);

    socket.receive(roomJoined);
    socket.receive(roomJoined);
    harness.client.sendAudio(frame);

    expect(sentTypes(socket)).toEqual(["join", "audio:start"]);
    expect(socket.sent).toContain(frame);
    expect(harness.messages).toEqual([roomJoined, roomJoined]);
  });

  it("starts audio once on a rejoined socket while capture remains active", () => {
    const harness = createHarness();
    const frame = new ArrayBuffer(4);
    harness.client.start();
    harness.client.startAudio();
    harness.sockets[0]!.open();
    harness.sockets[0]!.receive(roomJoined);

    harness.sockets[0]!.networkClose();
    harness.runTimer(250);
    const reconnected = harness.sockets[1]!;
    reconnected.open();
    harness.client.sendAudio(frame);
    expect(reconnected.sent).not.toContain(frame);

    reconnected.receive(roomJoined);
    reconnected.receive(roomJoined);
    harness.client.sendAudio(frame);

    expect(sentTypes(reconnected)).toEqual(["join", "audio:start"]);
    expect(reconnected.sent).toContain(frame);
  });

  it("offers manual reconnect after the bounded retry sequence is exhausted", () => {
    const harness = createHarness();
    harness.client.start();
    harness.sockets[0]!.open();

    for (const delay of [250, 500, 1_000, 2_000, 4_000]) {
      harness.sockets.at(-1)!.networkClose();
      harness.runTimer(delay);
      harness.sockets.at(-1)!.open();
    }
    harness.sockets.at(-1)!.networkClose();

    expect(harness.statuses.at(-1)).toBe("manual_reconnect");
    const socketCount = harness.sockets.length;
    harness.client.reconnect();
    expect(harness.statuses.at(-1)).toBe("connecting");
    expect(harness.sockets).toHaveLength(socketCount + 1);
  });
});
