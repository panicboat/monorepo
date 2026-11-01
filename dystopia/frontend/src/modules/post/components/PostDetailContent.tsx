"use client";

import { useState } from "react";
import { Tabs } from "@/components/ui/tab";
import { usePostCommentCountStore } from "@/stores/postCommentCountStore";
import { usePostDeletionStore } from "@/stores/postDeletionStore";
import { usePostQuoteCountStore } from "@/stores/postQuoteCountStore";
import { usePost } from "../hooks/usePost";
import { CommentComposer } from "./CommentComposer";
import { CommentList } from "./CommentList";
import { PostCardBinding } from "./PostCardBinding";
import { QuoteList } from "./QuoteList";

type PostDetailTab = "comments" | "quotes";

interface PostDetailContentProps {
  postId: string;
  initialTab?: PostDetailTab;
  focusComposer?: boolean;
}

export function PostDetailContent({ postId, initialTab = "comments", focusComposer = false }: PostDetailContentProps) {
  const { post, loading, error } = usePost(postId || null);
  const deleted = usePostDeletionStore((s) => !!s.deleted[postId]);
  const storedCommentsCount = usePostCommentCountStore((s) => s.counts[postId]);
  const storedQuotesCount = usePostQuoteCountStore((s) => s.counts[postId]);
  const [tab, setTab] = useState<PostDetailTab>(initialTab);
  const [focusRequest, setFocusRequest] = useState(focusComposer ? 1 : 0);

  if (loading) {
    return <p className="p-6 text-text-secondary">読み込み中…</p>;
  }
  if (error || !post || deleted) {
    return <p className="p-6 text-text-secondary">投稿が見つかりませんでした。</p>;
  }

  const commentsCount = storedCommentsCount ?? post.commentsCount;
  const quotesCount = storedQuotesCount ?? post.quotesCount;

  const handleCommentClick = () => {
    setTab("comments");
    setFocusRequest((n) => n + 1);
  };

  return (
    <>
      <PostCardBinding post={post} inDetail onCommentClick={handleCommentClick} />
      <section className="border-t border-divider">
        <Tabs
          items={[
            { id: "comments", label: `コメント ${commentsCount}` },
            { id: "quotes", label: `引用 ${quotesCount}` },
          ]}
          value={tab}
          onValueChange={(id) => setTab(id === "quotes" ? "quotes" : "comments")}
        />
        <div hidden={tab !== "comments"}>
          <CommentComposer postId={post.id} focusRequest={focusRequest} />
          <CommentList postId={post.id} />
        </div>
        {tab === "quotes" && <QuoteList postId={post.id} />}
      </section>
    </>
  );
}
