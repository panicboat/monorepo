"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useRankPosts } from "@/modules/discovery";
import type { RankPeriodLiteral } from "@/modules/discovery/types";

const TABS: TabItem[] = [
  { id: "day", label: "24h" },
  { id: "week", label: "1週間" },
  { id: "all", label: "全期間" },
];

export default function RankingPage() {
  const [period, setPeriod] = useState<RankPeriodLiteral>("week");
  const { posts, hasMore, loading, loadMore } = useRankPosts(period);

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">🏆 ランキング</h1>
      </div>
      <Tabs items={TABS} value={period} onValueChange={(v) => setPeriod(v as RankPeriodLiteral)} />

      {loading && posts.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">読み込み中…</p>
      )}
      {!loading && posts.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">ランキング対象の投稿がありません</p>
      )}

      {posts.map((post) => (
        <PostCardBinding key={post.id} post={post} />
      ))}

      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loading}>
            もっと見る
          </Button>
        </div>
      )}
    </main>
  );
}
