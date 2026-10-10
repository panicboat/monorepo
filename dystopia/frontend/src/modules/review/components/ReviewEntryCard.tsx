"use client";

import { IdentityLink } from "@/components/ui/identity-link";
import { useDeleteReview } from "../hooks/useDeleteReview";
import { useHideReview } from "../hooks/useHideReview";
import { useUnhideReview } from "../hooks/useUnhideReview";
import { useAuthStore } from "@/stores/authStore";
import { formatTimeAgo } from "@/lib/utils/date";
import { RatingStars } from "@/components/ui/rating-stars";
import type { ReviewEntry } from "../types";

interface Props {
  entry: ReviewEntry;
  mode: "written" | "received" | "recent";
  onChanged?: () => void;
}

export function ReviewEntryCard({ entry, mode, onChanged }: Props) {
  const viewerId = useAuthStore((s) => s.activeProfileId);
  const isAuthor = viewerId === entry.authorProfileId;
  const isTarget = viewerId === entry.targetProfileId;
  const { remove, loading: deleting } = useDeleteReview();
  const { hide, loading: hiding } = useHideReview();
  const { unhide, loading: unhiding } = useUnhideReview();
  const identityUsername = mode === "written" ? entry.targetUsername : entry.authorUsername;
  const identityAvatarUrl = mode === "written" ? entry.targetAvatarUrl : entry.authorAvatarUrl;

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {mode === "recent" ? (
          <>
            <IdentityLink username={entry.authorUsername} avatarUrl={entry.authorAvatarUrl} />
            <span className="text-muted-foreground">→</span>
            <IdentityLink username={entry.targetUsername} avatarUrl={entry.targetAvatarUrl} />
          </>
        ) : (
          <IdentityLink username={identityUsername} avatarUrl={identityAvatarUrl} />
        )}
        <span className="text-muted-foreground">{formatTimeAgo(entry.createdAt)}</span>
        {isTarget && entry.hidden && (
          <span className="ml-auto text-xs text-amber-600">非表示中</span>
        )}
      </div>
      <RatingStars value={entry.rating} className="mt-1 block w-fit text-base" />
      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
      <div className="mt-2 flex gap-3 text-sm text-muted-foreground">
        {isAuthor && (
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              if (!confirm("このレビューを削除しますか？")) return;
              await remove(entry.id);
              onChanged?.();
            }}
            className="hover:text-foreground"
          >
            削除
          </button>
        )}
        {isTarget && (
          entry.hidden ? (
            <button
              type="button"
              disabled={unhiding}
              onClick={async () => {
                await unhide(entry.id);
                onChanged?.();
              }}
              className="hover:text-foreground"
            >
              表示に戻す
            </button>
          ) : (
            <button
              type="button"
              disabled={hiding}
              onClick={async () => {
                await hide(entry.id);
                onChanged?.();
              }}
              className="hover:text-foreground"
            >
              非表示にする
            </button>
          )
        )}
      </div>
    </article>
  );
}
