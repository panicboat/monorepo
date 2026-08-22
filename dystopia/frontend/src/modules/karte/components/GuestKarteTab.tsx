"use client";

import { useGuestKarte } from "../hooks/useGuestKarte";
import { KarteAggregateHeader } from "./KarteAggregateHeader";
import { KarteComposer } from "./KarteComposer";
import { KarteEntryCard } from "./KarteEntryCard";

export function GuestKarteTab({ guestAccountId }: { guestAccountId: string }) {
  const { entries, aggregate, hasMore, loading, loadMore, refresh } = useGuestKarte(guestAccountId);

  return (
    <div>
      <KarteAggregateHeader aggregate={aggregate} />
      <KarteComposer targetAccountId={guestAccountId} onCreated={refresh} />
      {entries.map((e) => (
        <KarteEntryCard key={e.id} entry={e} onChanged={refresh} />
      ))}
      {loading && <div className="px-4 py-3 text-sm text-muted-foreground">読み込み中…</div>}
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
