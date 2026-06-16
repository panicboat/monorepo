// View shapes for bookmarks module.
// Post body uses the existing PostView from @/modules/post.

import type { PostView } from "@/modules/post/lib/post-view";

export type BookmarkStatusMap = Record<string, boolean>;

export interface PaginatedBookmarksResponse {
  posts: PostView[];
  nextCursor: string;
  hasMore: boolean;
}
