"use client";

import { useCallback, useState } from "react";
import type { ReviewEntry } from "../types";
import { ReviewCard } from "./ReviewCard";
import { ReviewDetailSheet } from "./ReviewDetailSheet";

interface Opened {
  entry: ReviewEntry;
  session: number;
  open: boolean;
}

interface ReviewListProps {
  entries: ReviewEntry[];
  variant: "feed" | "target" | "author";
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onChanged: () => void;
  empty: string;
}

export function ReviewList({ entries, variant, hasMore, loading, onLoadMore, onChanged, empty }: ReviewListProps) {
  // Keep the opened review after closing: dropping it would unmount the sheet before it slides out.
  const [opened, setOpened] = useState<Opened | null>(null);
  const close = useCallback(() => setOpened((current) => current && { ...current, open: false }), []);
  const current = opened ? (entries.find((e) => e.id === opened.entry.id) ?? opened.entry) : null;

  return (
    <div>
      {entries.map((entry) => (
        <ReviewCard
          key={entry.id}
          entry={entry}
          variant={variant}
          onOpen={(chosen) => setOpened((previous) => ({ entry: chosen, session: (previous?.session ?? 0) + 1, open: true }))}
        />
      ))}
      {!loading && entries.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-secondary">{empty}</p>}
      {loading && entries.length === 0 && <p className="px-4 py-3 text-sm text-text-secondary">読み込み中…</p>}
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
      {opened && current && (
        <ReviewDetailSheet key={opened.session} entry={current} open={opened.open} onClose={close} onChanged={onChanged} />
      )}
    </div>
  );
}
