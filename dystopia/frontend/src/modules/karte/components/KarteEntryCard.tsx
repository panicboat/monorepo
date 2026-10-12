"use client";

import { TriangleAlert, ChevronRight } from "lucide-react";
import { IdentityLink } from "@/components/ui/identity-link";
import { formatTimeAgo, isEditedAfterCreation } from "@/lib/utils/date";
import { RatingStars } from "@/components/ui/rating-stars";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { eventCatalog } from "../lib/event-catalog";
import type { KarteEntry } from "../types";

interface Props {
  entry: KarteEntry;
  mode: "my" | "target" | "recent";
  onOpen?: (entryId: string) => void;
}

export function KarteEntryCard({ entry, mode, onOpen }: Props) {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const writtenAsOtherProfile = mode === "my" && entry.authorProfileId !== activeProfileId;
  const latest = entry.latestEvent;
  const outcomes: Record<string, string> = latest ? eventCatalog[latest.stage].outcomes : {};
  return (
    <article className="border-b border-divider px-4 py-4 transition-colors hover:bg-bg-secondary/30">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {mode === "recent" ? <><IdentityLink username={entry.authorUsername} avatarUrl={entry.authorAvatarUrl} /><span className="text-text-muted">→</span><IdentityLink username={entry.targetUsername} avatarUrl={entry.targetAvatarUrl} /></> : <IdentityLink username={mode === "my" ? entry.targetUsername : entry.authorUsername} avatarUrl={mode === "my" ? entry.targetAvatarUrl : entry.authorAvatarUrl} />}
        <time dateTime={entry.createdAt} className="text-xs text-text-secondary">{formatTimeAgo(entry.createdAt)}</time>
        {entry.flagged && <TriangleAlert className="ml-auto size-4 text-warning" aria-label="複数の報告" />}
      </div>
      {writtenAsOtherProfile && <p className="mt-2 text-xs text-text-secondary">{entry.authorUsername ? `@${entry.authorUsername} として記録` : "削除したプロフィールで記録"}</p>}
      <button type="button" onClick={() => onOpen?.(entry.id)} className="mt-3 block w-full space-y-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent" aria-label={`カルテ詳細：${entry.targetUsername || "退会済のプロフィール"}`}>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">{entry.status === "open" ? "記録中" : "完了"}</span><span className="text-xs text-text-secondary">出来事 {entry.eventCount}件</span>{entry.isMine && <span className="text-xs text-accent">自分の記録</span>}</div>
        <div className="flex items-center gap-2">{entry.rating === null ? <span className="text-sm text-text-secondary">未評価</span> : <RatingStars value={entry.rating} className="text-base" />}{isEditedAfterCreation(entry.createdAt, entry.updatedAt) && <span className="text-xs text-text-muted">編集済み</span>}</div>
        {latest ? <div className="rounded-xl border border-divider bg-bg/40 px-3 py-2"><p className="text-xs text-text-secondary">最新の記録 · {eventCatalog[latest.stage].label} · {latest.occurredOn}</p><p className="mt-1 text-sm font-bold">{outcomes[latest.outcome]}</p>{latest.note && <p className="mt-1 line-clamp-2 whitespace-pre-wrap wrap-anywhere text-sm text-text-secondary">{latest.note}</p>}</div> : entry.body && <p className="line-clamp-2 whitespace-pre-wrap wrap-anywhere text-sm text-text-secondary">{entry.body}</p>}
        <span className="flex items-center justify-end gap-1 text-xs font-medium text-accent">詳細を見る<ChevronRight className="size-4" /></span>
      </button>
    </article>
  );
}
