"use client";

import { useReviewsByTarget } from "../hooks/useReviewsByTarget";
import { useReviewsByAuthor } from "../hooks/useReviewsByAuthor";
import { ReviewComposer } from "./ReviewComposer";
import { ReviewEntryCard } from "./ReviewEntryCard";

interface Props {
  accountId: string;
  mode: "received" | "written";
}

export function ReviewsTab({ accountId, mode }: Props) {
  const byTarget = useReviewsByTarget(mode === "received" ? accountId : null);
  const byAuthor = useReviewsByAuthor(mode === "written" ? accountId : null);
  const { entries, hasMore, loading, loadMore, refresh } =
    mode === "received" ? byTarget : byAuthor;

  return (
    <div>
      {mode === "received" && <ReviewComposer targetAccountId={accountId} onCreated={refresh} />}
      {entries.map((e) => (
        <ReviewEntryCard key={e.id} entry={e} onChanged={refresh} />
      ))}
      {loading && <div className="px-4 py-3 text-sm text-muted-foreground">読み込み中…</div>}
      {!loading && entries.length === 0 && (
        <div className="px-4 py-3 text-sm text-muted-foreground">まだレビューはありません。</div>
      )}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="block w-full px-4 py-3 text-sm text-muted-foreground hover:text-foreground"
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
