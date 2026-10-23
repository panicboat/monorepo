"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { MISSING_CAST, MISSING_GUEST, ProfileName, profileInitial } from "@/components/ui/profile-name";
import { formatTimeAgo } from "@/lib/utils/date";
import { formatMonthDay } from "@/lib/utils/japan-date";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { outcomeLabel, stageLabel, tagLabel } from "../lib/catalog";
import type { Review, ReviewEvent } from "../types";

export function reviewEventLine(event: ReviewEvent): string {
  const line = `${formatMonthDay(event.occurredOn)} · ${stageLabel(event.stage)} · ${outcomeLabel(event.stage, event.outcome)}`;
  return event.note ? `${line} — ${event.note}` : line;
}

interface ReviewCardProps {
  review: Review;
  variant: "feed" | "cast" | "mine";
  onOpen: (review: Review) => void;
}

export function ReviewCard({ review, variant, onOpen }: ReviewCardProps) {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const latest = review.events[review.events.length - 1];
  const writtenAsOtherProfile = variant === "mine" && review.authorProfileId !== activeProfileId;
  const authorHref = review.author?.username ? `/u/${encodeURIComponent(review.author?.username)}` : undefined;

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex gap-3">
        <Avatar
          src={review.author?.avatarUrl || undefined}
          fallback={profileInitial(review.author)}
          href={authorHref}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide text-text-secondary">クチコミ / ゲストからキャストへ</p>
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <ProfileName profile={review.author} link className="text-sm" missing={MISSING_GUEST} />
            <span className="shrink-0 text-text-secondary">· {formatTimeAgo(review.lastActivityAt)}</span>
          </p>
          {writtenAsOtherProfile && (
            <p className="text-xs text-text-secondary">
              {review.author?.username ? `@${review.author?.username} として記録` : `${MISSING_GUEST}として記録`}
            </p>
          )}
          <button
            type="button"
            onClick={() => onOpen(review)}
            className="mt-2 block w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-accent/60"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate">
                <ProfileName profile={review.target} missing={MISSING_CAST} />
                {review.target?.username && <span className="ml-1 text-xs text-text-secondary">@{review.target?.username}</span>}
              </span>
              <span className={review.rating === null ? "shrink-0 text-sm text-text-secondary" : "shrink-0 text-sm font-bold text-rating"}>
                {review.rating === null ? "未評価" : `★ ${review.rating.toFixed(1)}`}
              </span>
            </span>
            {latest && <span className="mt-1 line-clamp-2 block text-sm text-text-primary">{reviewEventLine(latest)}</span>}
            {latest && latest.tags.length > 0 && (
              <span className="mt-2 flex flex-wrap gap-1.5">
                {latest.tags.slice(0, 2).map((tag) => (
                  <span key={tag} className="rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                    {tagLabel(latest.stage, tag)}
                  </span>
                ))}
              </span>
            )}
          </button>
          {variant !== "cast" && review.target?.username && (
            <Link href={`/u/${review.target?.username}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent hover:underline">
              キャストのプロフィールを見る →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
