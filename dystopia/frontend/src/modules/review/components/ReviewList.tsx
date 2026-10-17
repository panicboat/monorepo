"use client";

import { useCallback, useState } from "react";
import type { Review } from "../types";
import { ReviewCard } from "./ReviewCard";
import { ReviewDetailSheet } from "./ReviewDetailSheet";

interface Opened {
  review: Review;
  session: number;
  open: boolean;
}

interface ReviewListProps {
  reviews: Review[];
  variant: "feed" | "cast" | "mine";
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  empty: string;
}

export function ReviewList({ reviews, variant, hasMore, loading, onLoadMore, empty }: ReviewListProps) {
  // Keep the opened review after closing: dropping it would unmount the sheet before it slides out.
  const [opened, setOpened] = useState<Opened | null>(null);
  const close = useCallback(() => setOpened((current) => current && { ...current, open: false }), []);

  return (
    <div>
      {reviews.map((review) => (
        <ReviewCard
          key={review.id}
          review={review}
          variant={variant}
          onOpen={(chosen) => setOpened((current) => ({ review: chosen, session: (current?.session ?? 0) + 1, open: true }))}
        />
      ))}
      {!loading && reviews.length === 0 && !hasMore && <p className="px-4 py-8 text-center text-sm text-text-secondary">{empty}</p>}
      {loading && reviews.length === 0 && <div className="px-4 py-3 text-sm text-text-secondary">読み込み中…</div>}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="block w-full px-4 py-3 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          もっと見る
        </button>
      )}
      {opened && <ReviewDetailSheet key={opened.session} review={opened.review} open={opened.open} onClose={close} />}
    </div>
  );
}
