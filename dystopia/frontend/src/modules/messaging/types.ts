import type { ProfileSummaryView } from "@/modules/profile/types";

export interface MessageView {
  id: string;
  threadId: string;
  senderProfileId: string;
  content: string;
  createdAt: string;
}

export interface ThreadView {
  id: string;
  counterpart: ProfileSummaryView | null;
  lastMessage: MessageView | null;
  unreadCount: number;
  lastMessageAt: string;
}

export type SendRestrictionView = "none" | "follow_required" | "blocked" | "counterpart_unavailable";

export interface ThreadDetailResponse {
  thread: ThreadView | null;
  sendRestriction: SendRestrictionView;
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
