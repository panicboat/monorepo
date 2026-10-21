"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import { useMyKarte } from "@/modules/karte/hooks/useMyKarte";
import { KarteList } from "@/modules/karte/components/KarteList";
import { useAuthStore, selectIsHydrated, selectRole } from "@/stores/authStore";

export function MyKarteHeader() {
  return <PageHeader title="自分のカルテ" description="自分が作成したカルテの一覧。ホームの「カルテ」は全キャストの新着です。" />;
}

interface Composing {
  session: number;
  open: boolean;
}

export default function MyKartePage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { kartes, counts, hasMore, loading, loadMore } = useMyKarte();
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);

  if (!isHydrated) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }

  if (role !== "cast") {
    return (
      <div className="p-4 text-sm">
        <p>カルテはキャストだけが使えます。</p>
        <Link href="/" className="mt-3 inline-block text-accent">ホームに戻る</Link>
      </div>
    );
  }

  const summary = [
    { label: "合計", value: counts.total },
    { label: "未評価", value: counts.unrated },
  ];

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <MyKarteHeader />
      </header>
      <div className="px-4 py-3">
        <Button type="button" onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}>
          ＋ カルテを作成
        </Button>
      </div>
      <div className="grid grid-cols-2 border-y border-border text-center">
        {summary.map((item) => (
          <div key={item.label} className="py-3">
            <p className="text-xl font-bold text-text-primary">{item.value}</p>
            <p className="text-xs text-text-secondary">{item.label}</p>
          </div>
        ))}
      </div>
      <KarteList kartes={kartes} variant="mine" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="自分のカルテはまだありません" />
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="karte"
          open={composing.open}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
