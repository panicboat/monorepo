
import type { PostView } from "@/modules/post/lib/post-view";

export type BookmarkStatusMap = Record<string, boolean>;

export interface BookmarkItemView {
  postId: string;
  post: PostView | null;
}

export interface PaginatedBookmarksResponse {
  items: BookmarkItemView[];
  nextCursor: string;
  hasMore: boolean;
}
