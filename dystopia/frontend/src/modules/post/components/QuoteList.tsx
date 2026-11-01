"use client";

import { Button } from "@/components/ui/button";
import { useQuotes } from "@/modules/post/hooks/useQuotes";
import { PostCardBinding } from "./PostCardBinding";

function Message({ children }: { children: string }) {
  return <p className="px-4 py-8 text-center text-text-secondary">{children}</p>;
}

export function QuoteList({ postId }: { postId: string }) {
  const { posts, hasMore, loading, error, loadMore } = useQuotes(postId);

  if (loading && posts.length === 0) return <Message>読み込み中…</Message>;
  if (error) return <Message>読み込みに失敗しました</Message>;
  if (posts.length === 0) return <Message>まだ引用はありません</Message>;

  return (
    <div>
      {posts.map((p) => (
        <PostCardBinding key={p.id} post={p} hideQuoteFrame />
      ))}
      {hasMore && (
        <div className="flex justify-center py-4">
          <Button variant="secondary" size="sm" onClick={() => loadMore()} disabled={loading}>
            {loading ? "読み込み中…" : "もっと見る"}
          </Button>
        </div>
      )}
    </div>
  );
}
