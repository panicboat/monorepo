"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatTimeAgo } from "@/lib/utils/date";
import type { CommentView } from "@/modules/post/lib/comment-view";
import type { PostView } from "@/modules/post/lib/post-view";

export interface ReplyWithParentRowProps {
  comment: CommentView;
  parentPost: PostView | null;
}

export function ReplyWithParentRow({ comment, parentPost }: ReplyWithParentRowProps) {
  const detailHref = `/posts/${encodeURIComponent(comment.postId)}`;
  return (
    <article className="border-b border-divider px-4 py-3">
      {parentPost ? (
        <Link
          href={detailHref}
          className="mb-2 block rounded-md border border-divider/60 bg-bg-surface/40 p-3 hover:bg-bg-surface/70"
        >
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Avatar
              src={parentPost.author?.avatarUrl || undefined}
              fallback={(parentPost.author?.displayName || "?").slice(0, 1)}
              size="sm"
            />
            <span className="font-bold text-text-primary">
              {parentPost.author?.displayName || "名無し"}
            </span>
            <span>· {parentPost.createdAt ? formatTimeAgo(parentPost.createdAt) : ""}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-text-primary">{parentPost.content}</p>
        </Link>
      ) : (
        <div className="mb-2 rounded-md border border-divider/60 bg-bg-surface/40 p-3 text-xs text-text-muted">
          元の投稿は表示できません
        </div>
      )}
      <div className="flex gap-3">
        <Avatar
          src={comment.author?.imageUrl || undefined}
          fallback={(comment.author?.name || "?").slice(0, 1)}
          size="sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-bold text-text-primary">{comment.author?.name || "—"}</span>
            <span className="text-text-muted">
              · {comment.createdAt ? formatTimeAgo(comment.createdAt) : ""}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-text-primary">{comment.content}</p>
        </div>
      </div>
    </article>
  );
}
