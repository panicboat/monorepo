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

const RECONNECT_GRACE_MS = 5_000;

export interface RoomRegistryDependencies {
  translator: Translator;
  recognizer: SpeechRecognizer;
  glossary?: readonly string[];
}

export class RoomRegistry {
  private readonly rooms = new Map<string, MeetingRoom>();
  private readonly roomIdByParticipantId = new Map<string, string>();
  private readonly reconnectExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly expiryCompletions = new Set<Promise<void>>();
  private readonly backgroundFailures: unknown[] = [];

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
    if (result.ok) {
      this.cancelReconnectExpiry(message.roomId);
      this.roomIdByParticipantId.set(result.participant.id, message.roomId);
    }
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
    await this.removeParticipant(participantId, false);
  }

  async disconnectForReconnect(participantId: string): Promise<void> {
    await this.removeParticipant(participantId, true);
  }

  private async removeParticipant(participantId: string, retainForReconnect: boolean): Promise<void> {
    const roomId = this.roomIdByParticipantId.get(participantId);
    if (!roomId) return;

    const room = this.rooms.get(roomId);
    this.roomIdByParticipantId.delete(participantId);
    if (!room) return;

    await room.disconnect(participantId);
    if (!room.isEmpty) return;

    if (retainForReconnect) {
      this.scheduleReconnectExpiry(roomId, room);
      return;
    }

    this.cancelReconnectExpiry(roomId);
    await room.destroy();
    if (this.rooms.get(roomId) === room) this.rooms.delete(roomId);
  }

  async destroyAll(): Promise<void> {
    for (const timer of this.reconnectExpiryTimers.values()) clearTimeout(timer);
    this.reconnectExpiryTimers.clear();
    const rooms = [...this.rooms.entries()];
    this.roomIdByParticipantId.clear();
    await Promise.all(rooms.map(async ([roomId, room]) => {
      await room.destroy();
      this.rooms.delete(roomId);
    }));
    await Promise.all(this.expiryCompletions);
    if (this.backgroundFailures.length > 0) {
      throw new AggregateError(this.backgroundFailures, "Reconnect expiry cleanup failed");
    }
  }

  private scheduleReconnectExpiry(roomId: string, room: MeetingRoom): void {
    this.cancelReconnectExpiry(roomId);
    const timer = setTimeout(() => {
      if (this.reconnectExpiryTimers.get(roomId) !== timer) return;
      this.reconnectExpiryTimers.delete(roomId);
      const completion = this.destroyExpiredRoom(roomId, room)
        .catch((error) => { this.backgroundFailures.push(error); })
        .finally(() => { this.expiryCompletions.delete(completion); });
      this.expiryCompletions.add(completion);
    }, RECONNECT_GRACE_MS);
    this.reconnectExpiryTimers.set(roomId, timer);
  }

  private cancelReconnectExpiry(roomId: string): void {
    const timer = this.reconnectExpiryTimers.get(roomId);
    if (timer) clearTimeout(timer);
    this.reconnectExpiryTimers.delete(roomId);
  }

  private async destroyExpiredRoom(roomId: string, room: MeetingRoom): Promise<void> {
    if (this.rooms.get(roomId) !== room || !room.isEmpty) return;
    await room.destroy();
    if (this.rooms.get(roomId) === room) this.rooms.delete(roomId);
  }
}
