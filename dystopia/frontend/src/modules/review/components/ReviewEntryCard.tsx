"use client";

import Image from "next/image";
import { useDeleteReview } from "../hooks/useDeleteReview";
import { useHideReview } from "../hooks/useHideReview";
import { useUnhideReview } from "../hooks/useUnhideReview";
import { useAuthStore } from "@/stores/authStore";
import { formatTimeAgo } from "@/lib/utils/date";
import type { ReviewEntry } from "../types";

interface Props {
  entry: ReviewEntry;
  onChanged?: () => void;
}

export function ReviewEntryCard({ entry, onChanged }: Props) {
  const viewerId = useAuthStore((s) => s.userId);
  const isAuthor = viewerId === entry.authorAccountId;
  const isTarget = viewerId === entry.targetAccountId;
  const { remove, loading: deleting } = useDeleteReview();
  const { hide, loading: hiding } = useHideReview();
  const { unhide, loading: unhiding } = useUnhideReview();

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {entry.authorAvatarUrl ? (
          <Image
            src={entry.authorAvatarUrl}
            alt=""
            width={32}
            height={32}
            className="size-8 rounded-full object-cover"
          />
        ) : (
          <div className="size-8 rounded-full bg-muted" />
        )}
        <span className="font-medium">{entry.authorUsername || "(退会済)"}</span>
        <span className="text-muted-foreground">{formatTimeAgo(entry.createdAt)}</span>
        {isTarget && entry.hidden && (
          <span className="ml-auto text-xs text-amber-600">非表示中</span>
        )}
      </div>
      <div className="mt-1 text-base">★ {entry.rating.toFixed(1)}</div>
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
