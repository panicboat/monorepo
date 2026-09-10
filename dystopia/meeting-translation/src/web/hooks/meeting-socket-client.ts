import type { ClientMessage, ServerMessage } from "../../shared/meeting.js";
import { AudioConnectionState, reconnectDelay } from "../lib/audio-connection.js";

type JoinMessage = Extract<ClientMessage, { type: "join" }>;
type MeetingControlMessage = Exclude<
  ClientMessage,
  { type: "join" } | { type: "audio:start" } | { type: "audio:stop" }
>;

export type MeetingSocketStatus = "connecting" | "connected" | "reconnecting" | "manual_reconnect" | "closed";

export interface MeetingJoinDetails {
  roomId: string;
  token: string;
  displayName: string;
  speechLanguage: JoinMessage["speechLanguage"];
  displayLanguage: JoinMessage["displayLanguage"];
}

export interface MeetingWebSocket {
  binaryType: BinaryType;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onopen: ((event: Event) => void) | null;
  readonly readyState: number;
  close(code?: number): void;
  send(data: string | ArrayBuffer): void;
}

export interface MeetingSocketClientDependencies {
  cancelTimer: (timerId: number) => void;
  createSocket: (url: string) => MeetingWebSocket;
  schedule: (run: () => void, delay: number) => number;
}

interface MeetingSocketClientCallbacks {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: MeetingSocketStatus) => void;
}

const SOCKET_OPEN = 1;

const isNetworkClose = (code: number): boolean => code === 1006 || code === 1012 || code === 1013;

const parseServerMessage = (data: unknown): ServerMessage | undefined => {
  if (typeof data !== "string") return undefined;
  try {
    return JSON.parse(data) as ServerMessage;
  } catch {
    // SILENT: malformed server frames cannot be recovered by the browser client.
    return undefined;
  }
};

export class MeetingSocketClient {
  private readonly audioState = new AudioConnectionState();
  private disposed = false;
  private retryCount = 0;
  private socket?: MeetingWebSocket;
  private timerId?: number;

  constructor(
    private readonly url: string,
    private readonly join: MeetingJoinDetails,
    private readonly dependencies: MeetingSocketClientDependencies,
    private readonly callbacks: MeetingSocketClientCallbacks,
  ) {}

  start(): void {
    this.openConnection();
  }

  reconnect(): void {
    this.cancelReconnectTimer();
    this.detachSocket();
    this.retryCount = 0;
    this.callbacks.onStatus("connecting");
    this.openConnection();
  }

  send(message: MeetingControlMessage): void {
    if (this.socket?.readyState === SOCKET_OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  sendAudio(audio: ArrayBuffer): void {
    if (this.audioState.canSendAudio() && this.socket?.readyState === SOCKET_OPEN) {
      this.socket.send(audio);
    }
  }

  startAudio(): void {
    if (this.audioState.startCapture() && this.socket?.readyState === SOCKET_OPEN) {
      this.socket.send(JSON.stringify({ type: "audio:start" } satisfies ClientMessage));
    }
  }

  stopAudio(): void {
    if (this.audioState.stopCapture() && this.socket?.readyState === SOCKET_OPEN) {
      this.socket.send(JSON.stringify({ type: "audio:stop" } satisfies ClientMessage));
    }
  }

  dispose(): void {
    this.disposed = true;
    this.cancelReconnectTimer();
    const socket = this.socket;
    this.socket = undefined;
    this.audioState.beginConnection();
    if (!socket) return;
    socket.onclose = null;
    socket.onmessage = null;
    socket.onopen = null;
    if (socket.readyState === SOCKET_OPEN) {
      socket.send(JSON.stringify({ type: "leave" } satisfies ClientMessage));
    }
    socket.close(1000);
  }

  private openConnection(): void {
    if (this.disposed) return;
    this.audioState.beginConnection();
    const socket = this.dependencies.createSocket(this.url);
    socket.binaryType = "arraybuffer";
    this.socket = socket;

    socket.onopen = () => {
      if (!this.isCurrent(socket)) return;
      socket.send(JSON.stringify({ type: "join", ...this.join, consent: true } satisfies ClientMessage));
    };
    socket.onmessage = (event) => {
      if (!this.isCurrent(socket)) return;
      const message = parseServerMessage(event.data);
      if (!message) return;
      if (message.type === "room:joined") {
        this.retryCount = 0;
        this.callbacks.onStatus("connected");
        if (this.audioState.markJoined()) {
          socket.send(JSON.stringify({ type: "audio:start" } satisfies ClientMessage));
        }
      }
      this.callbacks.onMessage(message);
    };
    socket.onclose = (event) => {
      if (!this.isCurrent(socket)) return;
      this.socket = undefined;
      this.audioState.beginConnection();
      if (!isNetworkClose(event.code)) {
        this.callbacks.onStatus("closed");
        return;
      }

      const delay = reconnectDelay(this.retryCount);
      if (delay === undefined) {
        this.callbacks.onStatus("manual_reconnect");
        return;
      }

      this.retryCount += 1;
      this.callbacks.onStatus("reconnecting");
      const timerId = this.dependencies.schedule(() => {
        if (this.timerId !== timerId || this.disposed) return;
        this.timerId = undefined;
        this.openConnection();
      }, delay);
      this.timerId = timerId;
    };
  }

  private isCurrent(socket: MeetingWebSocket): boolean {
    return !this.disposed && this.socket === socket;
  }

  private cancelReconnectTimer(): void {
    if (this.timerId !== undefined) this.dependencies.cancelTimer(this.timerId);
    this.timerId = undefined;
  }

  private detachSocket(): void {
    const socket = this.socket;
    this.socket = undefined;
    this.audioState.beginConnection();
    if (!socket) return;
    socket.onclose = null;
    socket.onmessage = null;
    socket.onopen = null;
    socket.close(1000);
  }
}
