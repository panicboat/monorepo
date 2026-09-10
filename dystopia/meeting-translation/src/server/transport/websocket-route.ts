import type { FastifyInstance } from "fastify";
import type WebSocket from "ws";

import { parseClientMessage, serializeServerMessage } from "../../shared/protocol.js";
import type { ServerMessage } from "../../shared/meeting.js";
import type { RoomConnection } from "../adapters/contracts.js";
import { RoomRegistry } from "../room/room-registry.js";

const invalidMessage: ServerMessage = { type: "status", code: "invalid_message" };

const parseTextFrame = (data: WebSocket.RawData): unknown => {
  try {
    return JSON.parse(data.toString());
  } catch {
    return undefined;
  }
};

const toAudioChunk = (data: WebSocket.RawData): Uint8Array => {
  if (Array.isArray(data)) return Buffer.concat(data);
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
};

const sendMessage = (socket: WebSocket, message: ServerMessage): void => {
  if (socket.readyState !== socket.OPEN) return;

  try {
    socket.send(serializeServerMessage(message));
  } catch (error) {
    // SILENT: a closing socket can reject a final status write after its close event.
    if (socket.readyState !== socket.OPEN) return;
    throw error;
  }
};

export const registerWebsocketRoute = (
  app: FastifyInstance,
  registry: RoomRegistry,
  path: string,
): void => {
  app.get(path, { websocket: true }, (socket) => {
    let participantId: string | undefined;
    let disconnected = false;
    let disconnectCompletion: Promise<void> | undefined;
    let messages = Promise.resolve();

    const connection: RoomConnection = { send: (message) => sendMessage(socket, message) };

    const disconnect = (): Promise<void> => {
      if (disconnectCompletion) return disconnectCompletion;
      disconnected = true;
      const id = participantId;
      participantId = undefined;
      disconnectCompletion = id ? registry.disconnect(id) : Promise.resolve();
      return disconnectCompletion;
    };

    const processMessage = async (data: WebSocket.RawData, isBinary: boolean): Promise<void> => {
      if (disconnected) return;

      if (isBinary) {
        if (!participantId || !registry.writeAudio(participantId, toAudioChunk(data))) {
          sendMessage(socket, invalidMessage);
        }
        return;
      }

      const parsed = parseClientMessage(parseTextFrame(data));
      if (!parsed.ok) {
        sendMessage(socket, invalidMessage);
        return;
      }

      if (parsed.value.type === "join") {
        if (participantId) {
          sendMessage(socket, invalidMessage);
          return;
        }

        const joined = registry.join(connection, parsed.value);
        if (!joined.ok) sendMessage(socket, { type: "status", code: joined.code });
        else participantId = joined.participant.id;
        return;
      }

      if (!participantId) {
        sendMessage(socket, invalidMessage);
        return;
      }

      await registry.handle(participantId, parsed.value);
    };

    socket.on("message", (data, isBinary) => {
      messages = messages
        .then(() => processMessage(data, isBinary))
        .catch(() => {
          app.log.error({ eventCode: "websocket_message_error", participantId });
          socket.close(1011);
        });
    });
    socket.once("close", () => {
      void disconnect().catch(() => {
        app.log.error({ eventCode: "websocket_disconnect_error", participantId });
      });
    });
    socket.on("error", () => {
      app.log.error({ eventCode: "websocket_error", participantId });
    });
  });
};
