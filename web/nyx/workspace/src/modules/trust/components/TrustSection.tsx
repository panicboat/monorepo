"use client";

import { useEffect, useCallback } from "react";
import { MessageSquare, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useReviews, useReviewStats } from "../hooks";
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
  const { reviews, loading: reviewsLoading, fetchReviews, hasMore } = useReviews();
  const { stats, loading: statsLoading } = useReviewStats(targetId);

  const loadReviews = useCallback(async () => {
    if (targetId) {
      await fetchReviews(targetId, "approved", { limit: PREVIEW_LIMIT });
    }
  }, [targetId, fetchReviews]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

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
        reviews={reviews}
        loading={reviewsLoading}
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
