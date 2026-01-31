/**
 * Concierge Module Types
 *
 * Types for chat and messaging functionality.
 */

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  readAt?: string;
}

export interface ChatRoom {
  id: string;
  participants: ChatParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChatParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  isOnline: boolean;
}

export interface ChatListItem {
  roomId: string;
  participant: ChatParticipant;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount: number;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
}
