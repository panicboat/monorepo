"use client";

import { TriangleAlert } from "lucide-react";
import { IdentityLink } from "@/components/ui/identity-link";
import { useState } from "react";
import { useDeleteKarte } from "../hooks/useDeleteKarte";
import { useReportKarte } from "../hooks/useReportKarte";
import { useUpdateKarte } from "../hooks/useUpdateKarte";
import { formatTimeAgo, isEditedAfterCreation } from "@/lib/utils/date";
import { RatingStars } from "@/components/ui/rating-stars";
import { EntryEditForm } from "@/components/ui/entry-edit-form";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import type { KarteEntry } from "../types";

interface Props {
  entry: KarteEntry;
  mode: "my" | "target" | "recent";
  onChanged?: () => void;
}

export function KarteEntryCard({ entry, mode, onChanged }: Props) {
  const isOwn = entry.isMine;
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const writtenAsOtherProfile = mode === "my" && entry.authorProfileId !== activeProfileId;
  const { remove, loading: deleting } = useDeleteKarte();
  const { report, loading: reporting } = useReportKarte();
  const { update, loading: updating, error: updateError } = useUpdateKarte();
  const [reportOpen, setReportOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const identityUsername = mode === "my" ? entry.targetUsername : entry.authorUsername;
  const identityAvatarUrl = mode === "my" ? entry.targetAvatarUrl : entry.authorAvatarUrl;

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
        {entry.flagged && (
          <span
            className="ml-auto text-xs text-amber-600"
            title="他 Cast から複数件 report されています"
          >
            <TriangleAlert className="size-4" />
          </span>
        )}
      </div>
      {writtenAsOtherProfile && (
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.authorUsername ? `@${entry.authorUsername} として記録` : "削除したプロフィールで記録"}
        </p>
      )}
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
        {isOwn ? (
          <>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="hover:text-foreground">
                編集
              </button>
            )}
            <button
              type="button"
              disabled={deleting}
              onClick={async () => {
                if (!confirm("このカルテを削除しますか？")) return;
                await remove(entry.id);
                onChanged?.();
              }}
              className="hover:text-foreground"
            >
              削除
            </button>
          </>
        ) : reportOpen ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const reason = (form.elements.namedItem("reason") as HTMLInputElement).value;
              await report(entry.id, reason);
              setReportOpen(false);
            }}
            className="flex gap-2"
          >
            <input
              name="reason"
              type="text"
              placeholder="理由"
              className="rounded border border-border px-2 py-1 text-sm"
            />
            <button type="submit" disabled={reporting} className="hover:text-foreground">
              送信
            </button>
            <button type="button" onClick={() => setReportOpen(false)}>
              キャンセル
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="hover:text-foreground"
          >
            報告
          </button>
        )}
      </div>
    </article>
  );
}
