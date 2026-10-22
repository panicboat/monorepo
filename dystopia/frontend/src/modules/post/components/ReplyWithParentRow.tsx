"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ProfileName } from "@/components/ui/profile-name";
import { formatTimeAgo } from "@/lib/utils/date";
import { isPlainClick } from "@/lib/utils/isPlainClick";
import { usePostSheetStore } from "@/stores/postSheetStore";
import type { CommentView } from "@/modules/post/lib/comment-view";
import { PostText } from "@/modules/post/lib/post-text";
import type { PostView } from "@/modules/post/lib/post-view";
import { crossesMidnight, formatScheduleDay } from "@/modules/schedule/lib/dates";

export interface ReplyWithParentRowProps {
  comment: CommentView;
  parentPost: PostView | null;
}

export function ReplyWithParentRow({ comment, parentPost }: ReplyWithParentRowProps) {
  const detailHref = `/posts/${encodeURIComponent(comment.postId)}`;
  const openPost = usePostSheetStore((s) => s.openPost);
  const openParent = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    openPost(comment.postId);
  };
  const authorHref = comment.author?.username
    ? `/u/${encodeURIComponent(comment.author.username)}`
    : undefined;
  const avatar = (
    <Avatar
      src={comment.author?.avatarUrl || undefined}
      fallback={(comment.author?.displayName || "?").slice(0, 1)}
      size="sm"
      href={authorHref}
    />
  );
  return (
    <article className="border-b border-divider px-4 py-3">
      {parentPost ? (
        <Link
          href={detailHref}
          onClick={openParent}
          className="mb-2 block rounded-md border border-divider/60 bg-bg-surface/40 p-3 hover:bg-bg-surface/70"
        >
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Avatar
              src={parentPost.author?.avatarUrl || undefined}
              fallback={(parentPost.author?.displayName || "?").slice(0, 1)}
              size="sm"
            />
            <ProfileName profile={parentPost.author} />
            <span>· {parentPost.publishedAt || parentPost.createdAt ? formatTimeAgo(parentPost.publishedAt || parentPost.createdAt) : ""}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-text-primary">
            {parentPost.schedule && parentPost.content.trim() === "" ? (
              `予定 ${formatScheduleDay(parentPost.schedule.workDate)}${parentPost.schedule.startTime}〜${parentPost.schedule.endTime}${
                crossesMidnight(parentPost.schedule.startTime, parentPost.schedule.endTime) ? " 翌日" : ""
              }`
            ) : (
              <PostText content={parentPost.content} mentions={parentPost.mentions} hashtags={parentPost.hashtags} />
            )}
          </p>
        </Link>
      ) : (
        <div className="mb-2 rounded-md border border-divider/60 bg-bg-surface/40 p-3 text-xs text-text-muted">
          元の投稿は表示できません
        </div>
      )}
      <div className="flex gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <ProfileName profile={comment.author} link className="text-sm" />
            <span className="text-text-muted">
              · {comment.createdAt ? formatTimeAgo(comment.createdAt) : ""}
            </span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-text-primary">
            <PostText content={comment.content} mentions={comment.mentions} />
          </p>
        </div>
      </div>
    </article>
  );
}
