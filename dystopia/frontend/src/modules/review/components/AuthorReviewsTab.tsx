"use client";

import { useAuthorReviews } from "../hooks/useAuthorReviews";
import { ReviewList } from "./ReviewList";

export function AuthorReviewsTab({ authorProfileId }: { authorProfileId: string }) {
  const { reviews, hasMore, loading, loadMore } = useAuthorReviews(authorProfileId);

  return <ReviewList reviews={reviews} variant="feed" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="クチコミはまだありません" />;
}
