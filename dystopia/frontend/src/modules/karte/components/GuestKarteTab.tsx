"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { useToastStore } from "@/stores/toastStore";
import { useGuestKarte } from "../hooks/useGuestKarte";
import { KarteAggregateHeader } from "./KarteAggregateHeader";
import { KarteComposer } from "./KarteComposer";
import { KarteEntryCard } from "./KarteEntryCard";
import { KarteDetailSheet } from "./KarteDetailSheet";

export function GuestKarteTab({ guestProfileId }: { guestProfileId: string }) {
  const { entries, aggregate, hasMore, initialized, loading, error, loadMore, refresh } = useGuestKarte(guestProfileId);
  const [openedEntryId, setOpenedEntryId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  if (error && !initialized) return <div role="alert" className="space-y-3 p-5"><p className="text-sm text-error">{error.message || "カルテを取得できませんでした"}</p><Button variant="secondary" onClick={() => void refresh()}>再試行</Button></div>;
  if (loading && !initialized) return <p className="p-5 text-sm text-text-secondary">読み込み中…</p>;
  return (
    <div>
      <KarteAggregateHeader aggregate={aggregate} />
      <div className="flex justify-end border-b border-divider p-4"><Button variant="secondary" onClick={() => { setOpenedEntryId(null); setCreating(true); }}>カルテを記録</Button></div>
      {entries.map((entry) => <KarteEntryCard key={entry.id} entry={entry} mode="target" onOpen={(id) => { setCreating(false); setOpenedEntryId(id); }} />)}
      {error && <p role="alert" className="p-4 text-sm text-error">{error.message || "カルテを取得できませんでした"}</p>}
      {loading && <p className="p-4 text-sm text-text-secondary">読み込み中…</p>}
      {hasMore && <div className="p-4 text-center"><Button variant="secondary" onClick={() => void loadMore()} disabled={loading}>もっと見る</Button></div>}
      <SideSheet open={creating} onOpenChange={setCreating} title="カルテを記録"><KarteComposer targetProfileId={guestProfileId} onCreated={() => { setCreating(false); useToastStore.getState().show("カルテを保存しました"); }} /></SideSheet>
      <KarteDetailSheet entryId={openedEntryId} onOpenChange={(open) => { if (!open) setOpenedEntryId(null); }} />
    </div>
  );
}
