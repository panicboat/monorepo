"use client";

import { Star, ThumbsUp } from "lucide-react";
import { ReviewStats as ReviewStatsType } from "../types";

interface ReviewStatsProps {
  stats: ReviewStatsType | null;
  loading?: boolean;
}

export function ReviewStatsDisplay({ stats, loading }: ReviewStatsProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-4 animate-pulse">
        <div className="h-6 w-20 bg-bg-secondary rounded" />
        <div className="h-6 w-16 bg-bg-secondary rounded" />
      </div>
    );
  }

  if (!stats || stats.totalReviews === 0) {
    return (
      <div className="flex items-center gap-2 text-text-muted">
        <Star className="h-4 w-4" />
        <span className="text-sm">レビューはまだありません</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      {/* Average Score */}
      <div className="flex items-center gap-1.5">
        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
        <span className="font-semibold text-text-primary">
          {stats.averageScore.toFixed(1)}
        </span>
        <span className="text-sm text-text-muted">
          ({stats.totalReviews}件)
        </span>
      </div>

      {/* Approval Rate */}
      <div className="flex items-center gap-1.5">
        <ThumbsUp className="h-4 w-4 text-green-500" />
        <span className="text-sm text-text-secondary">
          {stats.approvalRate}%
        </span>
      </div>
    </div>
  );
}
