"use client";

import { useEffect, useRef, useCallback } from "react";
import { Loader2, ArrowLeft, Star } from "lucide-react";
import Link from "next/link";
import { useInfiniteReviews } from "../hooks/useInfiniteReviews";
import { ReviewCard } from "./ReviewCard";
import type { ReviewStats } from "../types";

interface ReviewListPageProps {
  targetId: string;
  targetName: string;
  targetType: "cast" | "guest";
  backUrl: string;
  stats?: ReviewStats | null;
}

export function ReviewListPage({
  targetId,
  targetName,
  targetType,
  backUrl,
  stats,
}: ReviewListPageProps) {
  const { reviews, loading, loadingMore, hasMore, fetchInitial, fetchMore } =
    useInfiniteReviews({
      revieweeId: targetType === "cast" ? targetId : undefined,
      reviewerId: targetType === "guest" ? targetId : undefined,
      status: "approved",
    });

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Prevent browser scroll restoration from applying previous page's scroll position
  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loadingMore) {
        fetchMore();
      }
    },
    [hasMore, loadingMore, fetchMore]
  );

  useEffect(() => {
    const element = loadMoreRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(handleObserver, {
      rootMargin: "100px",
    });
    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  return (
    <div className="min-h-screen bg-surface-secondary pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-surface border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href={backUrl}
            className="p-2 -ml-2 rounded-full hover:bg-surface-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-text-primary" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-text-primary truncate">
              {targetName} のレビュー
            </h1>
            {stats && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span>{stats.averageScore.toFixed(1)}</span>
                <span className="text-text-muted">({stats.totalReviews}件)</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-text-muted" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-text-muted">
            <p className="text-sm">レビューはまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                showReviewerLink={targetType === "cast"}
              />
            ))}

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-4" />

            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-text-muted" />
              </div>
            )}

            {!hasMore && reviews.length > 0 && (
              <div className="text-center py-4 text-sm text-text-muted">
                すべてのレビューを表示しました
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
