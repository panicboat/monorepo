"use client";

import { useState } from "react";
import { EntryEditForm } from "@/components/ui/entry-edit-form";
import { RatingStars } from "@/components/ui/rating-stars";
import { SideSheet } from "@/components/ui/side-sheet";
import { formatTimeAgo, isEditedAfterCreation } from "@/lib/utils/date";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { useDeleteReview } from "../hooks/useDeleteReview";
import { useHideReview } from "../hooks/useHideReview";
import { useUnhideReview } from "../hooks/useUnhideReview";
import { useUpdateReview } from "../hooks/useUpdateReview";
import type { ReviewEntry } from "../types";
import { handle } from "./ReviewCard";

interface ReviewDetailSheetProps {
  entry: ReviewEntry;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const ACTION = "min-h-11 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50";

export function ReviewDetailSheet({ entry, open, onClose, onChanged }: ReviewDetailSheetProps) {
  const viewerId = useAuthStore((s) => s.activeProfileId);
  const isAuthor = viewerId === entry.authorProfileId;
  const isTarget = viewerId === entry.targetProfileId;
  const showToast = useToastStore((s) => s.show);
  const { remove, loading: deleting } = useDeleteReview();
  const { hide, loading: hiding } = useHideReview();
  const { unhide, loading: unhiding } = useUnhideReview();
  const { update, loading: updating, error: updateError } = useUpdateReview();
  const [editing, setEditing] = useState(false);

  const after = (succeeded: unknown, message: string) => {
    onChanged();
    if (succeeded) showToast(message);
    return succeeded;
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="レビューの詳細"
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs font-bold tracking-wide text-text-secondary">REVIEW / ゲストからキャスト</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-bold text-text-primary">{handle(entry.authorUsername)}</p>
          <p className="text-xs text-text-secondary">
            {handle(entry.targetUsername)} へのレビュー · {formatTimeAgo(entry.createdAt)}
          </p>
        </div>
        {editing ? (
          <EntryEditForm
            initialRating={entry.rating}
            initialBody={entry.body}
            saving={updating}
            error={updateError?.message}
            onCancel={() => setEditing(false)}
            onSave={async (rating, body) => {
              if (!after(await update(entry.id, rating, body), "レビューを更新しました")) return;
              setEditing(false);
            }}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <RatingStars value={entry.rating} className="text-3xl" />
              {isEditedAfterCreation(entry.createdAt, entry.updatedAt) && <span className="text-xs text-text-secondary">編集済み</span>}
            </div>
            {entry.body && <p className="whitespace-pre-wrap text-text-primary">{entry.body}</p>}
          </>
        )}
        {(isAuthor || isTarget) && !editing && (
          <div className="flex gap-4 border-t border-divider pt-3">
            {isAuthor && (
              <button type="button" onClick={() => setEditing(true)} className={ACTION}>
                編集
              </button>
            )}
            {isAuthor && (
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!confirm("このレビューを削除しますか？")) return;
                  if (after(await remove(entry.id), "レビューを削除しました")) onClose();
                }}
                className={ACTION}
              >
                削除
              </button>
            )}
            {isTarget &&
              (entry.hidden ? (
                <button type="button" disabled={unhiding} onClick={async () => after(await unhide(entry.id), "レビューを表示に戻しました")} className={ACTION}>
                  表示に戻す
                </button>
              ) : (
                <button type="button" disabled={hiding} onClick={async () => after(await hide(entry.id), "レビューを非表示にしました")} className={ACTION}>
                  非表示にする
                </button>
              ))}
          </div>
        )}
      </div>
    </SideSheet>
  );
}
