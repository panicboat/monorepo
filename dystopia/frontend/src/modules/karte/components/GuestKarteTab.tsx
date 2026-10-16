"use client";

import { useGuestKarte } from "../hooks/useGuestKarte";
import { KarteAggregateHeader } from "./KarteAggregateHeader";
import { KarteComposer } from "./KarteComposer";
import { KarteEntryCard } from "./KarteEntryCard";

export function GuestKarteTab({ guestProfileId }: { guestProfileId: string }) {
  const { kartes, reliability, hasMore, loading, loadMore, refresh } = useGuestKarte(guestProfileId);

  return (
    <div>
      <KarteAggregateHeader reliability={reliability} />
      <KarteComposer targetProfileId={guestProfileId} onCreated={refresh} />
      {kartes.map((karte) => (
        <KarteEntryCard key={karte.id} karte={karte} mode="target" onChanged={refresh} />
      ))}
      {loading && <div className="px-4 py-3 text-sm text-text-secondary">読み込み中…</div>}
      {hasMore && (
        <button
          type="button"
          onClick={loadMore}
          className="block w-full px-4 py-3 text-sm text-text-secondary hover:text-text-primary"
        >
          もっと見る
        </button>
      )}
    </div>
  );
}
