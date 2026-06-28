"use client";

import Link from "next/link";
import { useMyKarte } from "@/modules/karte/hooks/useMyKarte";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";

export default function MyKartePage() {
  const { hasAccess, loading: accessLoading } = useMyKarteAccess();
  const { entries, hasMore, loading, loadMore, refresh } = useMyKarte();

  if (accessLoading) return <div className="p-4 text-sm">読み込み中…</div>;
  if (!hasAccess) {
    return (
      <div className="p-4 text-sm">
        <p>カルテは有料機能です。</p>
        <p className="mt-2 text-muted-foreground">アクセス権の付与は運営にお問い合わせください。</p>
        <Link href="/" className="mt-3 inline-block text-accent">ホームに戻る</Link>
      </div>
    );
  }

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <h1 className="text-lg font-medium">自分のカルテ</h1>
      </header>
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
