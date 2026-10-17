import type { ProfileSummaryView } from "@/modules/profile/types";
import type { MentionView } from "./post-view";

export interface CommentView {
  id: string;
  postId: string;
  parentId: string | null;
  authorProfileId: string;
  content: string;
  createdAt: string;
  author: ProfileSummaryView | null;
  repliesCount: number;
  mentions: MentionView[];
}

export interface PaginatedCommentsResponse {
  comments: CommentView[];
  nextCursor: string;
  hasMore: boolean;
}

export type { MentionView };
