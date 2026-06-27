"use client";

import Image from "next/image";
import { useState } from "react";
import { useDeleteKarte } from "../hooks/useDeleteKarte";
import { useReportKarte } from "../hooks/useReportKarte";
import { useAuthStore } from "@/stores/authStore";
import type { KarteEntry } from "../types";

interface Props {
  entry: KarteEntry;
  onChanged?: () => void;
}

export function KarteEntryCard({ entry, onChanged }: Props) {
  const viewerId = useAuthStore((s) => s.userId);
  const isOwn = viewerId === entry.authorAccountId;
  const { remove, loading: deleting } = useDeleteKarte();
  const { report, loading: reporting } = useReportKarte();
  const [reportOpen, setReportOpen] = useState(false);

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
        <span className="font-medium">{entry.authorUsername || "(no username)"}</span>
        <span className="text-muted-foreground">
          {new Date(entry.createdAt).toLocaleString("ja-JP")}
        </span>
        {entry.flagged && (
          <span
            className="ml-auto text-xs text-amber-600"
            title="他 Cast から複数件 report されています"
          >
            ⚠︎ flagged
          </span>
        )}
      </div>
      <div className="mt-1 text-base">{"★".repeat(entry.rating)}{"☆".repeat(5 - entry.rating)}</div>
      {entry.body && <p className="mt-2 whitespace-pre-wrap text-sm">{entry.body}</p>}
      <div className="mt-2 flex gap-3 text-xs text-muted-foreground">
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
              className="rounded border border-border px-2 py-1 text-xs"
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
            report
          </button>
        )}
      </div>
    </article>
  );
}
