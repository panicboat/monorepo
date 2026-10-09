import type { SocialProfileView } from "@/modules/social";

export interface MessageView {
  id: string;
  threadId: string;
  senderProfileId: string;
  content: string;
  createdAt: string;
}

export interface ThreadView {
  id: string;
  counterpart: SocialProfileView | null;
  lastMessage: MessageView | null;
  unreadCount: number;
  lastMessageAt: string;
}

export interface PaginatedThreadsResponse {
  threads: ThreadView[];
  nextCursor: string;
  hasMore: boolean;
  totalUnreadCount: number;
}

export interface PaginatedMessagesResponse {
  messages: MessageView[];
  nextCursor: string;
  hasMore: boolean;
}

export type StreamEventPayload =
  | { type: "message"; data: MessageView }
  | { type: "read_state"; data: { threadId: string; profileId: string; lastReadMessageId: string } }
  | { type: "typing"; data: { threadId: string; profileId: string } };
