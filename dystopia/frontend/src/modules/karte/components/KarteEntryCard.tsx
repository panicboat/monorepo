"use client";

import Image from "next/image";
import { useState } from "react";
import { useDeleteKarte } from "../hooks/useDeleteKarte";
import { useReportKarte } from "../hooks/useReportKarte";
import { formatTimeAgo } from "@/lib/utils/date";
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
  const [reportOpen, setReportOpen] = useState(false);
  const identityUsername = mode === "my" ? entry.targetUsername : entry.authorUsername;
  const identityAvatarUrl = mode === "my" ? entry.targetAvatarUrl : entry.authorAvatarUrl;

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        {mode === "recent" ? (
          <>
            <IdentityAvatar url={entry.authorAvatarUrl} />
            <span className="font-medium">{entry.authorUsername || "(退会済)"}</span>
            <span className="text-muted-foreground">→</span>
            <IdentityAvatar url={entry.targetAvatarUrl} />
            <span className="font-medium">{entry.targetUsername || "(退会済)"}</span>
          </>
        ) : (
          <>
            <IdentityAvatar url={identityAvatarUrl} />
            <span className="font-medium">{identityUsername || "(退会済)"}</span>
          </>
        )}
        <span className="text-muted-foreground">{formatTimeAgo(entry.createdAt)}</span>
        {entry.flagged && (
          <span
            className="ml-auto text-xs text-amber-600"
            title="他 Cast から複数件 report されています"
          >
            ⚠︎
          </span>
        )}
      </div>
      {writtenAsOtherProfile && (
        <p className="mt-1 text-xs text-muted-foreground">
          {entry.authorUsername ? `@${entry.authorUsername} として記録` : "削除したプロフィールで記録"}
        </p>
      )}
      <div className="mt-1 text-base">{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</div>
      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
      <div className="mt-2 flex gap-3 text-sm text-muted-foreground">
        {isOwn ? (
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

function IdentityAvatar({ url }: { url: string }) {
  if (!url) return <div className="size-8 rounded-full bg-muted" />;
  return (
    <Image src={url} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
  );
}
