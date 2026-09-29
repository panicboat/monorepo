"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { Button } from "@/components/ui/button";
import { PostCardBinding } from "@/modules/post/components/PostCardBinding";
import { useFeed } from "@/modules/feed/hooks/useFeed";
import { useProfile } from "@/modules/profile/hooks/useProfile";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useRecentKarte } from "@/modules/karte/hooks/useRecentKarte";
import { KarteEntryCard } from "@/modules/karte/components/KarteEntryCard";
import { useRecentReviews } from "@/modules/review/hooks/useRecentReviews";
import { ReviewEntryCard } from "@/modules/review/components/ReviewEntryCard";
import type { FeedFilterValue } from "@/modules/feed/types";

type HomeTabValue = FeedFilterValue | "karte" | "reviews";

const POST_TAB_ITEMS: TabItem[] = [
  { id: "all", label: "全国" },
  { id: "area", label: "エリア" },
  { id: "following", label: "フォロー中" },
];

function isFeedFilter(tab: HomeTabValue): tab is FeedFilterValue {
  return tab === "all" || tab === "area" || tab === "following";
}

export default function HomePage() {
  const [tab, setTab] = useState<HomeTabValue>("all");
  const { profile } = useProfile();
  const role = useAuthStore(selectRole);
  const isPostTab = isFeedFilter(tab);
  const filter = isPostTab ? tab : "all";
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

  // Avoid duplicate initial fetches because Next.js can invoke this effect twice.
  const lastFetchFingerprint = useRef<string>("");
  useEffect(() => {
    if (!isPostTab) return;
    const fingerprint = `${filter}::${prefecture ?? ""}`;
    if (lastFetchFingerprint.current === fingerprint) return;
    lastFetchFingerprint.current = fingerprint;
    reset();
    fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPostTab, filter, prefecture]);

  const karte = useRecentKarte(tab === "karte");
  const reviews = useRecentReviews(tab === "reviews");

  const tabItems: TabItem[] = useMemo(() => {
    const items = [...POST_TAB_ITEMS];
    if (role === "cast") items.push({ id: "karte", label: "カルテ" });
    items.push({ id: "reviews", label: "レビュー" });
    return items;
  }, [role]);

  const showAreaHint = filter === "area" && !prefecture;
  const showEmptyState = initialized && !loading && posts.length === 0 && !showAreaHint;

  const postContent = useMemo(() => {
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

  const karteContent = useMemo(() => {
    if (karte.loading && karte.entries.length === 0) {
      return <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>;
    }
    if (karte.error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    return (
      <>
        {karte.entries.map((e) => (
          <KarteEntryCard key={e.id} entry={e} mode="recent" onChanged={karte.refresh} />
        ))}
        {karte.entries.length === 0 && !karte.hasMore && (
          <p className="px-4 py-8 text-center text-text-secondary">まだカルテがありません</p>
        )}
        {karte.hasMore && (
          <div className="px-4 py-4 text-center">
            <Button variant="secondary" onClick={() => karte.loadMore()} disabled={karte.loading}>
              {karte.loading ? "読み込み中…" : "もっと見る"}
            </Button>
          </div>
        )}
      </>
    );
  }, [karte.loading, karte.error, karte.entries, karte.hasMore, karte.refresh, karte.loadMore]);

  const reviewsContent = useMemo(() => {
    if (reviews.loading && reviews.entries.length === 0) {
      return <p className="px-4 py-8 text-center text-text-secondary">読み込み中…</p>;
    }
    if (reviews.error) {
      return <p className="px-4 py-8 text-center text-text-danger">読み込みに失敗しました</p>;
    }
    return (
      <>
        {reviews.entries.map((e) => (
          <ReviewEntryCard key={e.id} entry={e} mode="recent" onChanged={reviews.refresh} />
        ))}
        {reviews.entries.length === 0 && !reviews.hasMore && (
          <p className="px-4 py-8 text-center text-text-secondary">まだレビューがありません</p>
        )}
        {reviews.hasMore && (
          <div className="px-4 py-4 text-center">
            <Button variant="secondary" onClick={() => reviews.loadMore()} disabled={reviews.loading}>
              {reviews.loading ? "読み込み中…" : "もっと見る"}
            </Button>
          </div>
        )}
      </>
    );
  }, [reviews.loading, reviews.error, reviews.entries, reviews.hasMore, reviews.refresh, reviews.loadMore]);

  const content = tab === "karte" ? karteContent : tab === "reviews" ? reviewsContent : postContent;

  return (
    <main className="mx-auto flex max-w-xl flex-col bg-bg text-text-primary">
      <header className="sticky top-0 z-10 bg-bg">
        <Tabs
          items={tabItems}
          value={tab}
          onValueChange={(id) => setTab(id as HomeTabValue)}
        />
      </header>
      <section>{content}</section>
    </main>
  );
}
