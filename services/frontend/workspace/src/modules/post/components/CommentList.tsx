"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatTimeAgo } from "@/lib/utils/date";
import { useComments } from "@/modules/post/hooks/useComments";
import { useDeleteComment } from "@/modules/post/hooks/useDeleteComment";
import { ReplyList } from "./ReplyList";
import { ReplyComposer } from "./ReplyComposer";
import { useAuthStore, selectUserId } from "@/stores/authStore";

interface CommentListProps {
  postId: string;
}

export function CommentList({ postId }: CommentListProps) {
  const viewerId = useAuthStore(selectUserId);
  const { comments, hasMore, loading, error, loadMore } = useComments(postId);
  const { deleteComment, submitting: deleting } = useDeleteComment(postId);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [replying, setReplying] = useState<string | null>(null);

  if (loading && comments.length === 0) {
    return <p className="px-4 py-4 text-text-secondary">読み込み中…</p>;
  }
  if (error) {
    return <p className="px-4 py-4 text-text-secondary">読み込みに失敗しました</p>;
  }
  if (!loading && comments.length === 0) {
    return <p className="px-4 py-4 text-text-secondary">まだコメントはありません</p>;
  }

  const onDelete = async (commentId: string) => {
    if (!confirm("このコメントを削除しますか?")) return;
    await deleteComment(commentId).catch(() => {});
  };

  return (
    <div>
      {comments.map((c) => {
        const isOwn = !!viewerId && c.userId === viewerId;
        const isExpanded = !!expanded[c.id];
        return (
          <div key={c.id}>
            <article className="flex gap-3 border-b border-divider px-4 py-3">
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
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setReplying((cur) => (cur === c.id ? null : c.id))}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    {replying === c.id ? "返信を閉じる" : "返信する"}
                  </button>
                  {c.repliesCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((prev) => ({ ...prev, [c.id]: !prev[c.id] }))
                      }
                      className="text-text-secondary hover:text-text-primary"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "返信を隠す" : `${c.repliesCount} 件の返信を見る`}
                    </button>
                  )}
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => onDelete(c.id)}
                      disabled={deleting}
                      className="text-text-muted hover:text-error disabled:opacity-50"
                    >
                      削除
                    </button>
                  )}
                </div>
              </div>
            </article>
            {replying === c.id && (
              <ReplyComposer
                postId={postId}
                parentId={c.id}
                onCancel={() => setReplying(null)}
                onSubmitted={() => {
                  setReplying(null);
                  setExpanded((prev) => ({ ...prev, [c.id]: true }));
                }}
              />
            )}
            {isExpanded && <ReplyList postId={postId} commentId={c.id} />}
          </div>
        );
      })}
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
