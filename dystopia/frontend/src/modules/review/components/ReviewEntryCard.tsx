"use client";

import { IdentityLink } from "@/components/ui/identity-link";
import { useState } from "react";
import { useDeleteReview } from "../hooks/useDeleteReview";
import { useHideReview } from "../hooks/useHideReview";
import { useUnhideReview } from "../hooks/useUnhideReview";
import { useUpdateReview } from "../hooks/useUpdateReview";
import { useAuthStore } from "@/stores/authStore";
import { formatTimeAgo, isEditedAfterCreation } from "@/lib/utils/date";
import { RatingStars } from "@/components/ui/rating-stars";
import { EntryEditForm } from "@/components/ui/entry-edit-form";
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
  const { update, loading: updating, error: updateError } = useUpdateReview();
  const [editing, setEditing] = useState(false);
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
      {editing ? (
        <EntryEditForm
          initialRating={entry.rating}
          initialBody={entry.body}
          saving={updating}
          error={updateError?.message}
          onCancel={() => setEditing(false)}
          onSave={async (rating, body) => {
            if (!(await update(entry.id, rating, body))) return;
            setEditing(false);
            onChanged?.();
          }}
        />
      ) : (
        <>
          <div className="mt-1 flex items-center gap-2">
            <RatingStars value={entry.rating} className="text-base" />
            {isEditedAfterCreation(entry.createdAt, entry.updatedAt) && (
              <span className="text-xs text-muted-foreground">編集済み</span>
            )}
          </div>
          {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
        </>
      )}
      <div className="mt-2 flex gap-3 text-sm text-muted-foreground">
        {isAuthor && !editing && (
          <button type="button" onClick={() => setEditing(true)} className="hover:text-foreground">
            編集
          </button>
        )}
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
