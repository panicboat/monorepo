"use client";

import { useEffect, useState } from "react";
import { Loader2, ArrowLeft, Star, Shield } from "lucide-react";
import Link from "next/link";
import { InfiniteScroll } from "@/components/ui/InfiniteScroll";
import { useInfiniteReviews } from "../hooks/useInfiniteReviews";
import { useReviewStats } from "../hooks/useReviewStats";
import { usePendingReviews } from "../hooks/usePendingReviews";
import { ReviewCard } from "./ReviewCard";
import { useToast } from "@/components/ui/Toast";

type TabKey = "all" | "pending" | "approved" | "rejected";

const TABS: { key: TabKey; label: string; status?: string }[] = [
  { key: "all", label: "すべて" },
  { key: "pending", label: "承認待ち", status: "pending" },
  { key: "approved", label: "承認済み", status: "approved" },
  { key: "rejected", label: "却下", status: "rejected" },
];

export function CastReviewsPage({ castId }: { castId: string }) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const activeStatus = TABS.find((t) => t.key === activeTab)?.status;

  const { stats } = useReviewStats(castId);
  const {
    reviews,
    loading,
    loadingMore,
    hasMore,
    fetchInitial,
    fetchMore,
    reset,
  } = useInfiniteReviews({
    revieweeId: castId,
    status: activeStatus,
  });
  const {
    approveReview,
    rejectReview,
    mutate: mutatePending,
  } = usePendingReviews();

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  useEffect(() => {
    reset();
  }, [activeTab, reset]);

  const handleApprove = async (id: string) => {
    setActionLoadingId(id);
    try {
      await approveReview(id);
      toast({ title: "レビューを承認しました", variant: "success" });
      await mutatePending();
      reset();
    } catch {
      toast({ title: "承認に失敗しました", variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    try {
      await rejectReview(id);
      toast({ title: "レビューを却下しました", variant: "success" });
      await mutatePending();
      reset();
    } catch {
      toast({ title: "却下に失敗しました", variant: "destructive" });
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface-secondary text-text-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/cast/mypage"
            className="p-2 -ml-2 rounded-full hover:bg-surface-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-text-primary" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-text-primary">
              レビュー管理
            </h1>
            {stats && (
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  {stats.averageScore.toFixed(1)}
                </span>
                <span className="text-text-muted">
                  ({stats.totalReviews}件)
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-success" />
                  {stats.approvalRate}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-role-cast border-b-2 border-role-cast"
                  : "text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <p className="text-sm">
              {activeTab === "pending"
                ? "承認待ちのレビューはありません"
                : activeTab === "rejected"
                  ? "却下されたレビューはありません"
                  : "レビューはまだありません"}
            </p>
          </div>
        ) : (
          <InfiniteScroll
            hasMore={hasMore}
            loading={loadingMore}
            onLoadMore={fetchMore}
            endMessage="すべてのレビューを表示しました"
          >
            <div className="space-y-3">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  showActions={review.status === "pending"}
                  showReviewerLink
                  onApprove={handleApprove}
                  onReject={handleReject}
                  actionLoading={actionLoadingId === review.id}
                />
              ))}
            </div>
          </InfiniteScroll>
        )}
      </div>
    </div>
  );
}
