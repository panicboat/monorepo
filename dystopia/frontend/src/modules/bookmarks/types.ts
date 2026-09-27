
import type { PostView } from "@/modules/post/lib/post-view";

export type BookmarkStatusMap = Record<string, boolean>;

export interface PaginatedBookmarksResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
