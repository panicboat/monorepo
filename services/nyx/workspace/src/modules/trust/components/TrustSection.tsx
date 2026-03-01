"use client";

import { useEffect } from "react";
import { MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useInfiniteReviews, useReviewStats } from "../hooks";
import { ReviewStatsDisplay } from "./ReviewStatsDisplay";
import { ReviewList } from "./ReviewList";

interface TrustSectionProps {
  targetId: string;
  targetName?: string;
  showWriteReview?: boolean;
  reviewsLinkHref?: string;
}

const PREVIEW_LIMIT = 3;

export function TrustSection({
  targetId,
  reviewsLinkHref,
}: TrustSectionProps) {
  const { reviews, loading, hasMore, fetchInitial } = useInfiniteReviews({
    revieweeId: targetId,
    status: "approved",
  });
  const { stats, loading: statsLoading } = useReviewStats(targetId);

  useEffect(() => {
    if (targetId) {
      fetchInitial();
    }
  }, [targetId, fetchInitial]);

  const totalReviews = stats?.totalReviews || 0;
  const showSeeAllLink = reviewsLinkHref && (hasMore || totalReviews > PREVIEW_LIMIT);

  return (
    <div className="space-y-4">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-text-muted" />
          <h4 className="text-sm font-bold text-text-primary">レビュー</h4>
        </div>
        <ReviewStatsDisplay stats={stats} loading={statsLoading} />
      </div>

      {/* Review List */}
      <ReviewList
        reviews={reviews.slice(0, PREVIEW_LIMIT)}
        loading={loading}
        showReviewerLink={false}
        emptyMessage="まだレビューはありません"
      />

      {/* See All Link */}
      {showSeeAllLink && (
        <Link
          href={reviewsLinkHref}
          className="flex items-center justify-center gap-1 py-3 text-sm text-info hover:text-info-hover transition-colors"
        >
          <span>すべてのレビューを見る</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
