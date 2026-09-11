import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import type { Caption, ClientMessage, Participant, ServerMessage } from "../../shared/meeting.js";
import type { ClarificationRequest } from "../lib/clarification-copy.js";
import {
  MeetingSocketClient,
  type MeetingJoinDetails,
  type MeetingSocketStatus,
} from "./meeting-socket-client.js";

type MeetingControlMessage = Exclude<
  ClientMessage,
  { type: "join" } | { type: "audio:start" } | { type: "audio:stop" }
>;

export type { MeetingJoinDetails, MeetingSocketStatus } from "./meeting-socket-client.js";

export interface MeetingSocket {
  captions: Caption[];
  clarificationRequest?: ClarificationRequest;
  participants: Participant[];
  serverStatus?: Extract<ServerMessage, { type: "status" }>["code"];
  status: MeetingSocketStatus;
  reconnect: () => void;
  send: (message: MeetingControlMessage) => boolean;
  sendAudio: (audio: ArrayBuffer) => void;
  startAudio: () => void;
  stopAudio: () => void;
}

export interface MeetingSocketData {
  captions: Caption[];
  clarificationRequest?: ClarificationRequest;
  participants: Participant[];
  serverStatus?: Extract<ServerMessage, { type: "status" }>["code"];
}

type MeetingSocketDataAction = ServerMessage | { type: "client:reconnect" };

export const reduceMeetingSocketData = (
  state: MeetingSocketData,
  message: MeetingSocketDataAction,
): MeetingSocketData => {
  switch (message.type) {
    case "room:joined":
      return { ...state, participants: message.participants };
    case "participant:joined":
      return { ...state, participants: [...state.participants, message.participant] };
    case "participant:left":
      return {
        ...state,
        participants: state.participants.filter(
          (participant) => participant.id !== message.participant.id,
        ),
      };
    case "caption:pending":
    case "caption:final":
    case "caption:failed": {
      const captions = state.captions.filter((caption) => caption.id !== message.caption.id);
      return {
        ...state,
        captions: [...captions, message.caption].sort(
          (left, right) => left.sequence - right.sequence,
        ),
      };
    }
    case "clarification:requested":
      return { ...state, clarificationRequest: message };
    case "status":
      return { ...state, serverStatus: message.code };
    case "client:reconnect":
      return { ...state, serverStatus: undefined };
    default:
      return state;
  }
};

const socketUrl = (): string => {
  const url = new URL("/translate/ws", window.location.origin);
  url.protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

export const useMeetingSocket = (join: MeetingJoinDetails): MeetingSocket => {
  const clientRef = useRef<MeetingSocketClient | undefined>(undefined);
  const [data, dispatch] = useReducer(reduceMeetingSocketData, {
    captions: [],
    participants: [],
  });
  const [status, setStatus] = useState<MeetingSocketStatus>("connecting");

  const send = useCallback((message: MeetingControlMessage) => {
    return clientRef.current?.send(message) ?? false;
  }, []);

  const sendAudio = useCallback((audio: ArrayBuffer) => {
    clientRef.current?.sendAudio(audio);
  }, []);

  const startAudio = useCallback(() => {
    clientRef.current?.startAudio();
  }, []);

  const stopAudio = useCallback(() => {
    clientRef.current?.stopAudio();
  }, []);

  const reconnect = useCallback(() => {
    dispatch({ type: "client:reconnect" });
    clientRef.current?.reconnect();
  }, []);

  useEffect(() => {
    const client = new MeetingSocketClient(
      socketUrl(),
      join,
      {
        cancelTimer: (timerId) => window.clearTimeout(timerId),
        createSocket: (url) => new WebSocket(url),
        schedule: (run, delay) => window.setTimeout(run, delay),
      },
      {
        onMessage: dispatch,
        onStatus: setStatus,
      },
    );
    clientRef.current = client;
    client.start();

    return () => {
      client.dispose();
      if (clientRef.current === client) clientRef.current = undefined;
    };
  }, [join]);

  return {
    captions: data.captions,
    clarificationRequest: data.clarificationRequest,
    participants: data.participants,
    serverStatus: data.serverStatus,
    status,
    reconnect,
    send,
    sendAudio,
    startAudio,
    stopAudio,
  };
};
