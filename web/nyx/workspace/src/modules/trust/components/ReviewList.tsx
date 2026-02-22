"use client";

import { Loader2, MessageSquare } from "lucide-react";
import { Review } from "../types";
import { ReviewCard } from "./ReviewCard";

interface ReviewListProps {
  reviews: Review[];
  loading?: boolean;
  showActions?: boolean;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  actionLoadingId?: string | null;
  emptyMessage?: string;
}

export function ReviewList({
  reviews,
  loading = false,
  showActions = false,
  onApprove,
  onReject,
  actionLoadingId = null,
  emptyMessage = "レビューはまだありません",
}: ReviewListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-text-muted">
        <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          showActions={showActions}
          onApprove={onApprove}
          onReject={onReject}
          actionLoading={actionLoadingId === review.id}
        />
      ))}
    </div>
  );
}
