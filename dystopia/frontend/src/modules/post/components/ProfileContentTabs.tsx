"use client";

import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tab";
import { Button } from "@/components/ui/button";
import { useEnterAnimation } from "@/lib/motion/useEnterAnimation";
import { PostCardBinding } from "./PostCardBinding";
import { useAuthorPosts } from "@/modules/post/hooks/useAuthorPosts";
import { useAuthorLikedPosts } from "@/modules/post/hooks/useAuthorLikedPosts";

const TAB_ITEMS = [
  { id: "posts", label: "投稿" },
  { id: "media", label: "メディア" },
  { id: "likes", label: "いいね" },
] as const;

export interface ExtraTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface ProfileContentTabsProps {
  profileId: string;
  isOwnProfile?: boolean;
  leadingTabs?: ExtraTab[];
  extraTabs?: ExtraTab[];
  initialTab?: string;
}

export function ProfileContentTabs({ profileId, isOwnProfile = true, leadingTabs = [], extraTabs = [], initialTab }: ProfileContentTabsProps) {
  const tabItems = isOwnProfile ? TAB_ITEMS : TAB_ITEMS.filter((item) => item.id !== "likes");
  const [postsItem, ...restItems] = tabItems as unknown as { id: string; label: string }[];
  const allItems = [
    postsItem,
    ...leadingTabs.map((t) => ({ id: t.id, label: t.label })),
    ...restItems,
    ...extraTabs.map((t) => ({ id: t.id, label: t.label })),
  ];
  // FALLBACK: An unknown or missing initial tab opens the posts tab.
  const [tab, setTab] = useState<string>(() => (allItems.some((item) => item.id === initialTab) ? initialTab! : "posts"));
  const customTab = [...leadingTabs, ...extraTabs].find((t) => t.id === tab);
  const contentRef = useRef<HTMLDivElement>(null);
  useEnterAnimation(contentRef, tab);

  return (
    <section className="mt-4">
      <Tabs items={allItems} value={tab} onValueChange={setTab} />
      <div ref={contentRef}>
        {tab === "posts" && <AuthorPostsPane profileId={profileId} mediaOnly={false} />}
        {tab === "media" && <AuthorPostsPane profileId={profileId} mediaOnly={true} />}
        {tab === "likes" && isOwnProfile && <AuthorLikesPane profileId={profileId} />}
        {customTab?.content}
      </div>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return <p className="px-4 py-8 text-center text-text-secondary">{message}</p>;
}

function LoadMore({ hasMore, loading, onClick }: { hasMore: boolean; loading: boolean; onClick: () => void }) {
  if (!hasMore) return null;
  return (
    <div className="flex justify-center py-4">
      <Button variant="secondary" size="sm" onClick={onClick} disabled={loading}>
        {loading ? "読み込み中…" : "もっと見る"}
      </Button>
    </div>
  );
}

function AuthorPostsPane({ profileId, mediaOnly }: { profileId: string; mediaOnly: boolean }) {
  const { posts, hasMore, loading, error, loadMore } = useAuthorPosts(profileId, mediaOnly);
  if (loading && posts.length === 0) return <EmptyState message="読み込み中…" />;
  if (error) return <EmptyState message="読み込みに失敗しました" />;
  if (posts.length === 0)
    return <EmptyState message={mediaOnly ? "メディア付きの投稿はありません" : "まだ投稿はありません"} />;
  return (
    <div>
      {posts.map((p) => (
        <PostCardBinding key={p.id} post={p} />
      ))}
      <LoadMore hasMore={hasMore} loading={loading} onClick={loadMore} />
    </div>
  );
}

function AuthorLikesPane({ profileId }: { profileId: string }) {
  const { posts, hasMore, loading, error, loadMore } = useAuthorLikedPosts(profileId);
  if (loading && posts.length === 0) return <EmptyState message="読み込み中…" />;
  if (error) return <EmptyState message="読み込みに失敗しました" />;
  if (posts.length === 0) return <EmptyState message="まだいいねした投稿はありません" />;
  return (
    <div>
      {posts.map((p) => (
        <PostCardBinding key={p.id} post={p} />
      ))}
      <LoadMore hasMore={hasMore} loading={loading} onClick={loadMore} />
    </div>
  );
}
