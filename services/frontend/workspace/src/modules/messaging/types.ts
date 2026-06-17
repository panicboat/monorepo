import type { SocialAccountView } from "@/modules/social";

export interface MessageView {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ThreadView {
  id: string;
  counterpart: SocialAccountView | null;
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

// SSE bridge wire format (BFF → browser)
export type StreamEventPayload =
  | { type: "message"; data: MessageView }
  | { type: "read_state"; data: { threadId: string; accountId: string; lastReadMessageId: string } }
  | { type: "typing"; data: { threadId: string; accountId: string } };
