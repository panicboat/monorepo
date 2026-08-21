import { FeedFilter } from "@/stub/feed/v1/feed_service_pb";
import type { ListFeedResponse } from "@/stub/feed/v1/feed_service_pb";
import { mapPostToView } from "@/modules/post/lib/post-mappers";
import type { FeedFilterValue, FeedListView } from "@/modules/feed/types";

export function feedFilterFromString(value: FeedFilterValue | undefined): FeedFilter {
  switch (value) {
    case "area":
      return FeedFilter.AREA;
    case "following":
      return FeedFilter.FOLLOWING;
    case "all":
    default:
      return FeedFilter.ALL;
  }
}

export function mapFeedListResponse(res: ListFeedResponse): FeedListView {
  return {
    posts: (res.posts || []).map(mapPostToView),
    nextCursor: res.nextCursor || null,
    hasMore: res.hasMore || false,
  };
}
