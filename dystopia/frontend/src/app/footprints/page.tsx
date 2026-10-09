"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useFootprints, useFootprintsUnreadCount, markFootprintsRead } from "@/modules/footprints";
import { FootprintRow } from "@/modules/footprints/components/FootprintRow";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";

export function FootprintsHeader() {
  return <PageHeader title="足跡" description={getFeatureDescription("footprints")} />;
}

export default function FootprintsPage() {
  const { footprints, hasMore, loading, error, loadMore } = useFootprints();
  const unreadCount = useFootprintsUnreadCount();

  useEffect(() => {
    markFootprintsRead().then(() => unreadCount.refresh());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <FootprintsHeader />
      </div>

      {loading && footprints.length === 0 && (
        <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>
      )}
      {error && (
        <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>
      )}
      {!loading && footprints.length === 0 && !error && (
        <p className="px-4 py-8 text-center text-text-secondary">
          あなたを訪問した人はまだいません。
        </p>
      )}

      {footprints.map((f) => (
        <FootprintRow key={f.visitor.profileId} footprint={f} />
      ))}

      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="sm" onClick={loadMore} disabled={loading}>
            {loading ? "読み込み中…" : "もっと見る"}
          </Button>
        </div>
      )}
    </main>
  );
}
