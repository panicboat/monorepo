import { useCallback, useEffect, useRef, useState } from "react";

import type { Caption, ClientMessage, Participant, ServerMessage } from "../../shared/meeting.js";

const reconnectDelays = [250, 500, 1_000, 2_000, 4_000] as const;
type JoinMessage = Extract<ClientMessage, { type: "join" }>;

export type MeetingSocketStatus = "connecting" | "connected" | "reconnecting" | "manual_reconnect" | "closed";

export interface MeetingJoinDetails {
  roomId: string;
  token: string;
  displayName: string;
  speechLanguage: JoinMessage["speechLanguage"];
  displayLanguage: JoinMessage["displayLanguage"];
}

export interface MeetingSocket {
  captions: Caption[];
  participants: Participant[];
  serverStatus?: Extract<ServerMessage, { type: "status" }>["code"];
  status: MeetingSocketStatus;
  reconnect: () => void;
  send: (message: Exclude<ClientMessage, { type: "join" }>) => void;
  sendAudio: (audio: ArrayBuffer) => void;
}

const isNetworkClose = (code: number): boolean => code === 1006 || code === 1012 || code === 1013;

const socketUrl = (): string => {
  const url = new URL("/translate/ws", window.location.origin);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

const parseServerMessage = (data: unknown): ServerMessage | undefined => {
  if (typeof data !== "string") return undefined;
  try {
    return JSON.parse(data) as ServerMessage;
  } catch {
    // SILENT: malformed server frames cannot be recovered by the browser client.
    return undefined;
  }
};

export const useMeetingSocket = (join: MeetingJoinDetails): MeetingSocket => {
  const socketRef = useRef<WebSocket | undefined>(undefined);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<number | undefined>(undefined);
  const [connectionVersion, setConnectionVersion] = useState(0);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [serverStatus, setServerStatus] = useState<MeetingSocket["serverStatus"]>();
  const [status, setStatus] = useState<MeetingSocketStatus>("connecting");

  const send = useCallback((message: Exclude<ClientMessage, { type: "join" }>) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendAudio = useCallback((audio: ArrayBuffer) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(audio);
  }, []);

  const reconnect = useCallback(() => {
    retryRef.current = 0;
    setServerStatus(undefined);
    setStatus("connecting");
    setConnectionVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    const socket = new WebSocket(socketUrl());
    socket.binaryType = "arraybuffer";
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      if (disposed) return;
      retryRef.current = 0;
      setStatus("connected");
      socket.send(JSON.stringify({ type: "join", ...join, consent: true } satisfies ClientMessage));
    });

    socket.addEventListener("message", (event) => {
      const message = parseServerMessage(event.data);
      if (!message || disposed) return;

      switch (message.type) {
        case "room:joined":
          setParticipants(message.participants);
          return;
        case "participant:joined":
          setParticipants((current) => [...current, message.participant]);
          return;
        case "participant:left":
          setParticipants((current) => current.filter((participant) => participant.id !== message.participant.id));
          return;
        case "caption:pending":
        case "caption:final":
        case "caption:failed":
          setCaptions((current) => {
            const next = current.filter((caption) => caption.id !== message.caption.id);
            return [...next, message.caption].sort((left, right) => left.sequence - right.sequence);
          });
          return;
        case "status":
          setServerStatus(message.code);
          return;
        default:
          return;
      }
    });

    socket.addEventListener("close", (event) => {
      if (disposed) return;
      if (!isNetworkClose(event.code)) {
        setStatus("closed");
        return;
      }

      const delay = reconnectDelays[retryRef.current];
      if (delay === undefined) {
        setStatus("manual_reconnect");
        return;
      }

      retryRef.current += 1;
      setStatus("reconnecting");
      retryTimerRef.current = window.setTimeout(() => {
        if (!disposed) setConnectionVersion((version) => version + 1);
      }, delay);
    });

    return () => {
      disposed = true;
      if (retryTimerRef.current !== undefined) window.clearTimeout(retryTimerRef.current);
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "leave" }));
      socket.close(1000);
      if (socketRef.current === socket) socketRef.current = undefined;
    };
  }, [connectionVersion, join]);

  return { captions, participants, serverStatus, status, reconnect, send, sendAudio };
};
