"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import { useMyReviews } from "@/modules/review/hooks/useMyReviews";
import { ReviewList } from "@/modules/review/components/ReviewList";
import { useAuthStore, selectIsHydrated, selectRole } from "@/stores/authStore";

export function MyReviewsHeader() {
  return <PageHeader title="自分のクチコミ" description="自分が書いたクチコミの一覧。ホームの「クチコミ」は全員の新着です。" />;
}

interface Composing {
  session: number;
  open: boolean;
}

export default function MyReviewsPage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { reviews, counts, hasMore, loading, loadMore } = useMyReviews();
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<Composing | null>(null);

  if (!isHydrated) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }

  if (role !== "guest") {
    return (
      <div className="p-4 text-sm">
        <p>クチコミはゲストだけが書けます。</p>
        <Link href="/" className="mt-3 inline-block text-accent">ホームに戻る</Link>
      </div>
    );
  }

  const summary = [
    { label: "自分のクチコミ", value: counts.total },
    { label: "記録中", value: counts.open },
    { label: "完了", value: counts.closed },
  ];

  return (
    <div>
      <header className="border-b border-border px-4 py-3">
        <MyReviewsHeader />
      </header>
      <div className="px-4 py-3">
        <Button type="button" onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}>
          ＋ クチコミを作成
        </Button>
      </div>
      <div className="grid grid-cols-3 border-y border-border text-center">
        {summary.map((item) => (
          <div key={item.label} className="py-3">
            <p className="text-xl font-bold text-text-primary">{item.value}</p>
            <p className="text-xs text-text-secondary">{item.label}</p>
          </div>
        ))}
      </div>
      <ReviewList reviews={reviews} variant="mine" hasMore={hasMore} loading={loading} onLoadMore={loadMore} empty="自分のクチコミはまだありません" />
      {composing && (
        <ComposeToSheet
          key={composing.session}
          kind="review"
          open={composing.open}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
