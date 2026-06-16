"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/utils/date";
import { useReplies } from "@/modules/post/hooks/useReplies";
import { useDeleteComment } from "@/modules/post/hooks/useDeleteComment";
import { useAuthStore, selectUserId } from "@/stores/authStore";

interface ReplyListProps {
  postId: string;
  commentId: string;
}

export function ReplyList({ postId, commentId }: ReplyListProps) {
  const viewerId = useAuthStore(selectUserId);
  const { replies, hasMore, loading, error, loadMore } = useReplies(postId, commentId, true);
  const { deleteComment, submitting: deleting } = useDeleteComment(postId);

  if (loading && replies.length === 0) {
    return <p className="py-2 pl-12 pr-4 text-sm text-text-secondary">読み込み中…</p>;
  }
  if (error) {
    return <p className="py-2 pl-12 pr-4 text-sm text-text-secondary">読み込みに失敗しました</p>;
  }
  if (!loading && replies.length === 0) {
    return <p className="py-2 pl-12 pr-4 text-sm text-text-secondary">返信はまだありません</p>;
  }

  const onDelete = async (id: string) => {
    if (!confirm("この返信を削除しますか?")) return;
    await deleteComment(id).catch(() => {});
  };

  return (
    <div className="bg-bg-secondary/30">
      {replies.map((r) => {
        const isOwn = !!viewerId && r.userId === viewerId;
        return (
          <article key={r.id} className="flex gap-3 border-b border-divider py-3 pl-12 pr-4">
            <Avatar
              src={r.author?.imageUrl || undefined}
              fallback={(r.author?.name || "?").slice(0, 1)}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1 text-sm">
                <span className="font-bold text-text-primary">{r.author?.name || "—"}</span>
                <span className="text-text-muted">· {r.createdAt ? formatTimeAgo(r.createdAt) : ""}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-text-primary">{r.content}</p>
              {isOwn && (
                <button
                  type="button"
                  onClick={() => onDelete(r.id)}
                  disabled={deleting}
                  className="mt-2 text-xs text-text-muted hover:text-error disabled:opacity-50"
                >
                  削除
                </button>
              )}
            </div>
          </article>
        );
      })}
      {hasMore && (
        <div className="flex justify-center py-2 pl-12 pr-4">
          <Button variant="secondary" size="sm" onClick={() => loadMore()} disabled={loading}>
            返信をもっと見る
          </Button>
        </div>
      )}
    </div>
  );
}
