import type { ProfileSummaryView } from "@/modules/profile/types";

export interface MentionView {
  profileId: string;
  username: string;
  position: number;
  length: number;
}

export interface PostMediaView {
  id: string;
  mediaType: "image" | "video";
  url: string;
  thumbnailUrl: string;
  mediaId: string;
}

export interface PostScheduleView {
  workDate: string;
  startTime: string;
  endTime: string;
}

export interface PostView {
  id: string;
  authorProfileId: string;
  content: string;
  media: PostMediaView[];
  createdAt: string;
  publishedAt: string;
  expiresAt: string;
  author: ProfileSummaryView | null;
  likesCount: number;
  commentsCount: number;
  visibility: "public" | "private";
  hashtags: string[];
  mentions: MentionView[];
  liked: boolean;
  schedule: PostScheduleView | null;
  pinned: boolean;
}

export interface SavePostMediaInput {
  mediaType: "image" | "video";
  mediaId: string;
}

export interface SavePostPayload {
  content: string;
  media?: SavePostMediaInput[];
  visibility?: "public" | "private";
  hashtags?: string[];
  publishedAt?: string;
  expiresAt?: string;
}

export interface PostsListView {
  posts: PostView[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface PostLikeStatus {
  liked: Record<string, boolean>;
}

export interface PostLikeResult {
  likesCount: number;
}
