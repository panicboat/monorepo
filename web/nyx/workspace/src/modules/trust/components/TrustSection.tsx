"use client";

import { useEffect, useCallback } from "react";
import { MessageSquare } from "lucide-react";
import { useReviews, useReviewStats } from "../hooks";
import { ReviewStatsDisplay } from "./ReviewStatsDisplay";
import { ReviewList } from "./ReviewList";

interface TrustSectionProps {
  targetId: string;
  targetName?: string;
  showWriteReview?: boolean;
}

export function TrustSection({
  targetId,
}: TrustSectionProps) {
  const { reviews, loading: reviewsLoading, fetchReviews } = useReviews();
  const { stats, loading: statsLoading } = useReviewStats(targetId);

  const loadReviews = useCallback(async () => {
    if (targetId) {
      await fetchReviews(targetId, "approved");
    }
  }, [targetId, fetchReviews]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

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
        emptyMessage="まだレビューはありません"
      />
    </div>
  );
}
