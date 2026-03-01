"use client";

import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { usePendingReviews } from "../hooks/usePendingReviews";
import { ReviewCard } from "./ReviewCard";
import { useToast } from "@/components/ui/Toast";

export function PendingReviewsSection() {
  const { toast } = useToast();
  const { pendingReviews, loading, approveReview, rejectReview } =
    usePendingReviews();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await approveReview(id);
      toast({
        title: "レビューを承認しました",
        variant: "success",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "承認に失敗しました";
      toast({
        title: "エラー",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await rejectReview(id);
      toast({
        title: "レビューを拒否しました",
        variant: "success",
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "拒否に失敗しました";
      toast({
        title: "エラー",
        description: message,
        variant: "destructive",
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  if (loading || pendingReviews.length === 0) {
    return null;
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-role-cast" />
        <h4 className="text-sm font-bold text-text-primary">
          承認待ちのレビュー
          <span className="ml-2 px-2 py-0.5 text-xs bg-role-cast text-white rounded-full">
            {pendingReviews.length}
          </span>
        </h4>
      </div>

      {/* Reviews */}
      <div className="space-y-3">
        {pendingReviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
            showActions
            onApprove={handleApprove}
            onReject={handleReject}
            actionLoading={actionLoadingId === review.id}
          />
        ))}
      </div>
    </section>
  );
}
