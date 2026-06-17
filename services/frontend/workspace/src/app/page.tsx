"use client";

import { useEffect, useMemo, useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { Button } from "@/components/ui/button";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useFeed } from "@/modules/feed/hooks/useFeed";
import { useProfile } from "@/modules/profile/hooks/useProfile";
import type { FeedFilterValue } from "@/modules/feed/types";

const TAB_ITEMS: TabItem[] = [
  { id: "all", label: "全国" },
  { id: "area", label: "エリア" },
  { id: "following", label: "フォロー中" },
];

export default function HomePage() {
  const [filter, setFilter] = useState<FeedFilterValue>("all");
  const { profile } = useProfile();
  const prefecture = filter === "area" ? profile?.prefecture || undefined : undefined;

  const {
    posts,
    loading,
    loadingMore,
    error,
    hasMore,
    initialized,
    fetchInitial,
    fetchMore,
    reset,
  } = useFeed({ filter, prefecture });

  // Re-fetch when filter or prefecture changes.
  useEffect(() => {
    reset();
    fetchInitial();
    // fetchInitial / reset are stable from usePaginatedFetch; we intentionally depend on
    // filter and prefecture so a tab switch (or profile-loaded prefecture) refreshes the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, prefecture]);

  const showAreaHint = filter === "area" && !prefecture;
  const showEmptyState = initialized && !loading && posts.length === 0 && !showAreaHint;

  const content = useMemo(() => {
    if (!initialized && loading) {
      return <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>;
    }
    if (error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    if (showAreaHint) {
      return (
        <p className="px-4 py-8 text-center text-text-secondary">
          エリアタブを使うにはプロフィールに都道府県を設定してください。
        </p>
      );
    }
    if (showEmptyState) {
      return <p className="px-4 py-8 text-center text-text-secondary">まだ投稿がありません</p>;
    }
    return (
      <>
        {posts.map((post) => (
          <PostCardBinding key={post.id} post={post} />
        ))}
        {hasMore && (
          <div className="px-4 py-4 text-center">
            <Button
              variant="secondary"
              onClick={() => fetchMore()}
              disabled={loadingMore}
            >
              {loadingMore ? "読み込み中…" : "もっと見る"}
            </Button>
          </div>
        )}
      </>
    );
  }, [initialized, loading, error, showAreaHint, showEmptyState, posts, hasMore, loadingMore, fetchMore]);

  return (
    <main className="mx-auto flex max-w-xl flex-col bg-bg text-text-primary">
      <header className="sticky top-0 z-10 bg-bg">
        <Tabs
          items={TAB_ITEMS}
          value={filter}
          onValueChange={(id) => setFilter(id as FeedFilterValue)}
        />
      </header>
      <section>{content}</section>
    </main>
  );
}
