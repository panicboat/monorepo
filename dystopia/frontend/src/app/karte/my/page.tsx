"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { useMyKarte } from "@/modules/karte/hooks/useMyKarte";
import { useAuthStore, selectIsHydrated, selectRole } from "@/stores/authStore";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";

export function MyKarteHeader() {
  return <PageHeader title="自分のカルテ" description={getFeatureDescription("karte")} />;
}

export default function MyKartePage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { kartes, hasMore, loading, loadMore, refresh } = useMyKarte();

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

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <MyKarteHeader />
      </header>
      {kartes.map((karte) => (
        <KarteEntryCard key={karte.id} karte={karte} mode="my" onChanged={refresh} />
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
