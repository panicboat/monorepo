"use client";

import { LockedNotice } from "@/components/ui/locked-notice";
import { useAuthorReviews } from "../hooks/useAuthorReviews";
import { ReviewList } from "./ReviewList";

export function AuthorReviewsTab({ authorProfileId }: { authorProfileId: string }) {
  const { reviews, hiddenByLock, hasMore, loading, loadMore } = useAuthorReviews(authorProfileId);

  if (hiddenByLock) return <LockedNotice />;

  return <ReviewList reviews={reviews} variant="feed" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="クチコミはまだありません" />;
}
