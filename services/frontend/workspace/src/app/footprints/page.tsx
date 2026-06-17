"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useFootprints, useFootprintsUnreadCount, markFootprintsRead } from "@/modules/footprints";
import { FootprintRow } from "@/modules/footprints/components/FootprintRow";

export default function FootprintsPage() {
  const { footprints, hasMore, loading, error, loadMore } = useFootprints();
  const unreadCount = useFootprintsUnreadCount();

  useEffect(() => {
    markFootprintsRead().then(() => unreadCount.refresh());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <h1 className="px-4 pb-2 pt-4 text-xl font-bold">足跡</h1>

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
        <FootprintRow key={f.visitor.accountId} footprint={f} />
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
