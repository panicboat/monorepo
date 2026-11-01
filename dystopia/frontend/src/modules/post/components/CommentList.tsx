"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName } from "@/components/ui/profile-name";
import { formatTimeAgo } from "@/lib/utils/date";
import { useComments } from "@/modules/post/hooks/useComments";
import { useDeleteComment } from "@/modules/post/hooks/useDeleteComment";
import { PostText } from "@/modules/post/lib/post-text";
import { ReportButton } from "@/modules/report";
import { ReplyList } from "./ReplyList";
import { ReplyComposer } from "./ReplyComposer";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { toastOnFailure } from "@/stores/toastStore";

interface CommentListProps {
  postId: string;
}

export function CommentList({ postId }: CommentListProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
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
    await deleteComment(commentId).catch(toastOnFailure("コメントを削除できませんでした"));
  };

  return (
    <div>
      {comments.map((c) => {
        const isOwn = !!viewerId && c.authorProfileId === viewerId;
        const isExpanded = !!expanded[c.id];
        const authorHref = c.author?.username ? `/u/${encodeURIComponent(c.author.username)}` : undefined;
        const avatar = (
          <Avatar
            src={c.author?.avatarUrl || undefined}
            fallback={(c.author?.displayName || "?").slice(0, 1)}
            size="sm"
            href={authorHref}
          />
        );
        return (
          <div key={c.id}>
            <article className="flex gap-3 border-b border-divider px-4 py-3">
              {avatar}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 text-sm">
                  <ProfileName profile={c.author} link className="text-sm" />
                  <span className="text-text-muted">· {c.createdAt ? formatTimeAgo(c.createdAt) : ""}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-text-primary">
                  <PostText content={c.content} mentions={c.mentions} />
                </p>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <button
                    type="button"
                    onClick={() => setReplying((cur) => (cur === c.id ? null : c.id))}
                    className="text-text-secondary hover:text-text-primary"
                  >
                    {replying === c.id ? "返信を閉じる" : "返信する"}
                  </button>
                  {c.repliesCount > 0 && !isExpanded && (
                    <button
                      type="button"
                      onClick={() => setExpanded((prev) => ({ ...prev, [c.id]: true }))}
                      className="text-text-secondary hover:text-text-primary"
                    >
                      {`${c.repliesCount} 件の返信を見る`}
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
                  {viewerId && !isOwn && (
                    <ReportButton targetType="comment" targetId={c.id} label="通報" className="text-text-muted hover:text-text-primary" />
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
