"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/utils/date";
import { useComments } from "@/modules/post/hooks/useComments";

interface CommentListProps {
  postId: string;
}

export function CommentList({ postId }: CommentListProps) {
  const { comments, hasMore, loading, error, loadMore } = useComments(postId);

  if (loading && comments.length === 0) {
    return <p className="px-4 py-4 text-text-secondary">読み込み中…</p>;
  }
  if (error) {
    return <p className="px-4 py-4 text-text-secondary">読み込みに失敗しました</p>;
  }
  if (!loading && comments.length === 0) {
    return <p className="px-4 py-4 text-text-secondary">まだコメントはありません</p>;
  }

  return (
    <div>
      {comments.map((c) => (
        <article key={c.id} className="flex gap-3 border-b border-divider px-4 py-3">
          <Avatar
            src={c.author?.imageUrl || undefined}
            fallback={(c.author?.name || "?").slice(0, 1)}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-sm">
              <span className="font-bold text-text-primary">{c.author?.name || "—"}</span>
              <span className="text-text-muted">· {c.createdAt ? formatTimeAgo(c.createdAt) : ""}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-text-primary">{c.content}</p>
            {c.repliesCount > 0 && (
              <p className="mt-2 text-xs text-text-secondary">{c.repliesCount} 件の返信</p>
            )}
          </div>
        </article>
      ))}
      {hasMore && (
        <div className="flex justify-center px-4 py-4">
          <Button variant="secondary" size="md" onClick={() => loadMore()} disabled={loading}>
            もっと見る
          </Button>
        </div>
      )}
    </div>
  );
}
