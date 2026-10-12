"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tab";
import { RouteFade } from "@/lib/motion/RouteFade";
import { ComposeToDialog } from "@/components/compose/ComposeToDialog";
import { useMyKarte } from "@/modules/karte/hooks/useMyKarte";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";
import { KarteDetailSheet } from "@/modules/karte/components/KarteDetailSheet";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";
import type { KarteStatus } from "@/modules/karte/types";

export function MyKarteHeader() {
  return <PageHeader title="自分のカルテ" description={getFeatureDescription("karte")} />;
}

export default function MyKartePage() {
  const { hasAccess, loading: accessLoading, error: accessError, refresh: retryAccess } = useMyKarteAccess();
  const [status, setStatus] = useState<"all" | KarteStatus>("all");
  const [openedEntryId, setOpenedEntryId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const { entries, counts, hasMore, loading, error, loadMore, refresh } = useMyKarte(status, hasAccess);
  if (accessLoading) return <p className="p-5 text-sm text-text-secondary">読み込み中…</p>;
  if (accessError) return <div role="alert" className="space-y-3 p-5"><p className="text-sm text-error">{accessError.message || "アクセスを確認できませんでした"}</p><Button variant="secondary" onClick={() => void retryAccess()}>再試行</Button></div>;
  if (!hasAccess) return <div className="space-y-3 p-5 text-sm text-text-secondary"><p>カルテはキャスト向けの記録・共有機能です。</p><Link href="/" className="inline-block text-accent">ホームに戻る</Link></div>;
  return <div>
    <header className="space-y-4 border-b border-divider p-5"><MyKarteHeader /><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-text-secondary">全 {counts.total}件 · 記録中 {counts.open}件 · 完了 {counts.closed}件</p><Button variant="secondary" size="sm" onClick={() => { setOpenedEntryId(null); setCreating(true); }}>カルテを記録</Button></div></header>
    <Tabs items={[{ id: "all", label: `全件 (${counts.total})` }, { id: "open", label: `記録中 (${counts.open})` }, { id: "closed", label: `完了 (${counts.closed})` }]} value={status} onValueChange={(value) => { setOpenedEntryId(null); setStatus(value as "all" | KarteStatus); }} />
    <RouteFade transitionKey={status}>
      {error && <div role="alert" className="space-y-3 p-5"><p className="text-sm text-error">{error.message || "カルテを取得できませんでした"}</p><Button variant="secondary" onClick={() => void refresh()}>再試行</Button></div>}
      {entries.map((entry) => <KarteEntryCard key={entry.id} entry={entry} mode="my" onOpen={(id) => { setCreating(false); setOpenedEntryId(id); }} />)}
      {loading && <p className="p-5 text-sm text-text-secondary">読み込み中…</p>}
      {!loading && !error && !entries.length && <p className="p-5 text-sm text-text-secondary">{status === "all" ? "カルテはまだありません" : status === "open" ? "記録中のカルテはありません" : "完了したカルテはありません"}</p>}
      {hasMore && <div className="p-4 text-center"><Button variant="secondary" onClick={() => void loadMore()} disabled={loading}>もっと見る</Button></div>}
    </RouteFade>
    <ComposeToDialog kind="karte" open={creating} onClose={() => setCreating(false)} />
    <KarteDetailSheet entryId={openedEntryId} onOpenChange={(open) => { if (!open) setOpenedEntryId(null); }} />
  </div>;
}
