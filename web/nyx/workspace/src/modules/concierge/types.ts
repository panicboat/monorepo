/**
 * Concierge domain types
 * Chat and messaging
 */

export type MessageStatus = "sending" | "sent" | "delivered" | "read" | "error";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  status: MessageStatus;
  createdAt: string;
}

export interface Conversation {
  id: string;
  participants: ConversationParticipant[];
  lastMessage?: ChatMessage;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  role: "cast" | "guest";
}
