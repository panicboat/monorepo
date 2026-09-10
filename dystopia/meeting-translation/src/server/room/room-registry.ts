import { createHash, randomBytes, randomUUID } from "node:crypto";

import type { ClientMessage } from "../../shared/meeting.js";
import type {
  CreatedRoom,
  JoinResult,
  RoomConnection,
  SpeechRecognizer,
  Translator,
} from "../adapters/contracts.js";
import { MeetingRoom, type RoomJoinResult } from "./meeting-room.js";

export type { CreatedRoom, JoinResult } from "../adapters/contracts.js";

export interface RoomRegistryDependencies {
  translator: Translator;
  recognizer: SpeechRecognizer;
  glossary?: readonly string[];
}

export class RoomRegistry {
  private readonly rooms = new Map<string, MeetingRoom>();
  private readonly roomIdByParticipantId = new Map<string, string>();

  constructor(private readonly dependencies: RoomRegistryDependencies) {}

  create(): CreatedRoom {
    const roomId = randomUUID();
    const joinToken = randomBytes(32).toString("base64url");
    const joinTokenHash = createHash("sha256").update(joinToken).digest();
    this.rooms.set(
      roomId,
      new MeetingRoom({ ...this.dependencies, roomId, joinTokenHash }),
    );
    return { roomId, joinToken };
  }

  join(connection: RoomConnection, message: ClientMessage): JoinResult {
    if (message.type !== "join" || message.consent !== true) return { ok: false, code: "invalid_message" };

    const room = this.rooms.get(message.roomId);
    if (!room) return { ok: false, code: "room_not_found" };

    const result: RoomJoinResult = room.join(connection, message);
    if (result.ok) this.roomIdByParticipantId.set(result.participant.id, message.roomId);
    return result;
  }

  async handle(participantId: string, message: Exclude<ClientMessage, { type: "join" }>): Promise<void> {
    const roomId = this.roomIdByParticipantId.get(participantId);
    const room = roomId ? this.rooms.get(roomId) : undefined;
    if (room) await room.handle(participantId, message);
  }

  writeAudio(participantId: string, chunk: Uint8Array): boolean {
    const roomId = this.roomIdByParticipantId.get(participantId);
    return roomId ? this.rooms.get(roomId)?.writeAudio(participantId, chunk) ?? false : false;
  }

  async disconnect(participantId: string): Promise<void> {
    const roomId = this.roomIdByParticipantId.get(participantId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    this.roomIdByParticipantId.delete(participantId);
    if (!room) return;

    await room.disconnect(participantId);
    if (!room.isEmpty) return;

    await room.destroy();
    this.rooms.delete(roomId);
  }

  async destroyAll(): Promise<void> {
    const rooms = [...this.rooms.values()];
    this.rooms.clear();
    this.roomIdByParticipantId.clear();
    await Promise.all(rooms.map((room) => room.destroy()));
  }
}
