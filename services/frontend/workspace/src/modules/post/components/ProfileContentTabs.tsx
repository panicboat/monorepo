"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Tabs } from "@/components/ui/tab";
import { Button } from "@/components/ui/button";
import { PostCardBinding } from "./PostCardBinding";
import { ReplyWithParentRow } from "./ReplyWithParentRow";
import { useAuthorPosts } from "@/modules/post/hooks/useAuthorPosts";
import { useAuthorComments } from "@/modules/post/hooks/useAuthorComments";
import { useAuthorLikedPosts } from "@/modules/post/hooks/useAuthorLikedPosts";

const TAB_ITEMS = [
  { id: "posts", label: "投稿" },
  { id: "replies", label: "返信" },
  { id: "media", label: "メディア" },
  { id: "likes", label: "いいね" },
] as const;

export interface ExtraTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface ProfileContentTabsProps {
  accountId: string;
  extraTabs?: ExtraTab[];
}

export function ProfileContentTabs({ accountId, extraTabs = [] }: ProfileContentTabsProps) {
  const [tab, setTab] = useState<string>("posts");
  const allItems = [
    ...(TAB_ITEMS as unknown as { id: string; label: string }[]),
    ...extraTabs.map((t) => ({ id: t.id, label: t.label })),
  ];
  const extraTab = extraTabs.find((t) => t.id === tab);

  return (
    <section className="mt-4">
      <Tabs
        items={allItems}
        value={tab}
        onValueChange={setTab}
      />
      <div>
        {tab === "posts" && <AuthorPostsPane accountId={accountId} mediaOnly={false} />}
        {tab === "replies" && <AuthorRepliesPane accountId={accountId} />}
        {tab === "media" && <AuthorPostsPane accountId={accountId} mediaOnly={true} />}
        {tab === "likes" && <AuthorLikesPane accountId={accountId} />}
        {extraTab?.content}
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

function AuthorPostsPane({ accountId, mediaOnly }: { accountId: string; mediaOnly: boolean }) {
  const { posts, hasMore, loading, error, loadMore } = useAuthorPosts(accountId, mediaOnly);
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

function AuthorRepliesPane({ accountId }: { accountId: string }) {
  const { comments, postsById, hasMore, loading, error, loadMore } = useAuthorComments(accountId);
  if (loading && comments.length === 0) return <EmptyState message="読み込み中…" />;
  if (error) return <EmptyState message="読み込みに失敗しました" />;
  if (comments.length === 0) return <EmptyState message="まだ返信はありません" />;
  return (
    <div>
      {comments.map((c) => (
        <ReplyWithParentRow key={c.id} comment={c} parentPost={postsById[c.postId] || null} />
      ))}
      <LoadMore hasMore={hasMore} loading={loading} onClick={loadMore} />
    </div>
  );
}

function AuthorLikesPane({ accountId }: { accountId: string }) {
  const { posts, hasMore, loading, error, loadMore } = useAuthorLikedPosts(accountId);
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
