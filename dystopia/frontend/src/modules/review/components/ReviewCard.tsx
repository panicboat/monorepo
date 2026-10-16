"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatTimeAgo } from "@/lib/utils/date";
import { useAuthStore } from "@/stores/authStore";
import type { ReviewEntry } from "../types";

export function handle(username: string): string {
  return username ? `@${username}` : "(退会済)";
}

interface ReviewCardProps {
  entry: ReviewEntry;
  variant: "feed" | "target" | "author";
  onOpen: (entry: ReviewEntry) => void;
}

export function ReviewCard({ entry, variant, onOpen }: ReviewCardProps) {
  const viewerId = useAuthStore((s) => s.activeProfileId);
  const hiddenForViewer = entry.hidden && viewerId === entry.targetProfileId;

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex gap-3">
        <Avatar src={entry.authorAvatarUrl || undefined} fallback={(entry.authorUsername || "?").slice(0, 1)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide text-text-secondary">REVIEW / ゲストからキャストへ</p>
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <span className="truncate font-bold text-text-primary">{handle(entry.authorUsername)}</span>
            <span className="shrink-0 text-text-secondary">· {formatTimeAgo(entry.createdAt)}</span>
          </p>
          <button
            type="button"
            onClick={() => onOpen(entry)}
            className="mt-2 block w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-accent/60"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-bold text-text-primary">{handle(entry.targetUsername)}</span>
              <span className="shrink-0 text-sm font-bold text-rating">★ {entry.rating.toFixed(1)}</span>
            </span>
            {entry.body && <span className="mt-1 line-clamp-2 block text-sm text-text-primary">{entry.body}</span>}
            <span className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">ゲストによるレビュー</span>
              {hiddenForViewer && (
                <span className="rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-xs text-warning">非表示中</span>
              )}
            </span>
          </button>
          {variant !== "target" && entry.targetUsername && (
            <Link href={`/u/${encodeURIComponent(entry.targetUsername)}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent hover:underline">
              キャストのプロフィールを見る →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
