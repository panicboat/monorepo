"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tab";
import { usePostCommentCountStore } from "@/stores/postCommentCountStore";
import { usePostDeletionStore } from "@/stores/postDeletionStore";
import type { PostDetailTab } from "@/stores/postSheetStore";
import { usePost } from "../hooks/usePost";
import { CommentComposer } from "./CommentComposer";
import { CommentList } from "./CommentList";
import { PostCardBinding } from "./PostCardBinding";
import { QuoteList } from "./QuoteList";

export function PostDetailContent({ postId, initialTab = "comments" }: { postId: string; initialTab?: PostDetailTab }) {
  const { post, loading, error } = usePost(postId || null);
  const deleted = usePostDeletionStore((s) => !!s.deleted[postId]);
  const storedCommentsCount = usePostCommentCountStore((s) => s.counts[postId]);
  const [tab, setTab] = useState<PostDetailTab>(initialTab);

  if (loading) {
    return <p className="p-6 text-text-secondary">読み込み中…</p>;
  }
  if (error || !post || deleted) {
    return <p className="p-6 text-text-secondary">投稿が見つかりませんでした。</p>;
  }

  const commentsCount = storedCommentsCount ?? post.commentsCount;

  return (
    <>
      <PostCardBinding post={post} inDetail />
      <section className="border-t border-divider">
        <Tabs
          items={[
            { id: "comments", label: `コメント ${commentsCount}` },
            { id: "quotes", label: `引用 ${post.quotesCount}` },
          ]}
          value={tab}
          onValueChange={(id) => setTab(id === "quotes" ? "quotes" : "comments")}
        />
        {tab === "comments" ? (
          <>
            <CommentComposer postId={post.id} />
            <CommentList postId={post.id} />
          </>
        ) : (
          <QuoteList postId={post.id} />
        )}
      </section>
    </>
  );
}
