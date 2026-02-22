"use client";

import { useEffect, useState, useCallback } from "react";
import { MessageSquare, Edit3 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useReviews, useReviewStats } from "../hooks";
import { TrustTagsSection } from "./TrustTagsSection";
import { ReviewStatsDisplay } from "./ReviewStatsDisplay";
import { ReviewList } from "./ReviewList";
import { WriteReviewModal } from "./WriteReviewModal";
import { Button } from "@/components/ui/Button";

interface TrustSectionProps {
  targetId: string;
  targetName?: string;
  showWriteReview?: boolean;
}

export function TrustSection({
  targetId,
  targetName = "キャスト",
  showWriteReview = true,
}: TrustSectionProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const [showReviewModal, setShowReviewModal] = useState(false);

  const { reviews, loading: reviewsLoading, fetchReviews, createReview } = useReviews();
  const { stats, loading: statsLoading, mutate: refreshStats } = useReviewStats(targetId);

  const loadReviews = useCallback(async () => {
    if (targetId) {
      await fetchReviews(targetId, "approved");
    }
  }, [targetId, fetchReviews]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const handleSubmitReview = async (score: number, content: string) => {
    await createReview({ revieweeId: targetId, score, content });
    await loadReviews();
    refreshStats();
  };

  if (!isHydrated) {
    return null;
  }

  const isLoggedIn = isAuthenticated();

  return (
    <div className="space-y-6">
      {/* Tags Section (only for authenticated users) */}
      {isLoggedIn && <TrustTagsSection targetId={targetId} />}

      {/* Reviews Section */}
      <div className="space-y-4">
        {/* Header with Stats */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-text-muted" />
            <h4 className="text-sm font-bold text-text-primary">レビュー</h4>
          </div>
          <ReviewStatsDisplay stats={stats} loading={statsLoading} />
        </div>

        {/* Write Review Button */}
        {isLoggedIn && showWriteReview && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowReviewModal(true)}
            className="w-full"
          >
            <Edit3 className="h-4 w-4 mr-2" />
            レビューを書く
          </Button>
        )}

        {/* Review List */}
        <ReviewList
          reviews={reviews}
          loading={reviewsLoading}
          emptyMessage="まだレビューはありません"
        />
      </div>

      {/* Write Review Modal */}
      <WriteReviewModal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSubmit={handleSubmitReview}
        castName={targetName}
      />
    </div>
  );
}
