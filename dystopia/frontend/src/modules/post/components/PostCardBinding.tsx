"use client";

import Link from "next/link";
import { PostCard } from "@/components/ui/post-card";
import { formatTimeAgo } from "@/lib/utils/date";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostLike } from "@/modules/post/hooks/usePostLike";
import { useBookmark } from "@/modules/bookmarks";

export interface PostCardBindingProps {
  post: PostView;
  /** Whether to wrap the body / time area with a link to the post detail page. */
  detailHref?: string;
  className?: string;
}

export function PostCardBinding({ post, detailHref, className }: PostCardBindingProps) {
  const { isLiked, getLikesCount, toggleLike, loading } = usePostLike();
  const { isBookmarked, toggle: toggleBookmark, loading: bookmarkLoading } = useBookmark(post.id);

  const liked = isLiked(post.id, post.liked);
  const likesCount = getLikesCount(post.id, post.likesCount);

  const authorName = post.author?.displayName || "名無し";
  const authorHandle = post.author?.username || post.authorId.slice(0, 8);
  const avatarSrc = post.author?.avatarUrl || undefined;
  const authorHref = post.author?.username
    ? `/u/${encodeURIComponent(post.author.username)}`
    : undefined;

  const images = post.media
    .filter((m) => m.mediaType === "image")
    .map((m) => m.thumbnailUrl || m.url)
    .filter((u) => u.length > 0);

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLike(post.id, liked).catch(() => {});
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmark().catch(() => {});
  };

  const reactions = (
    <>
      <button
        type="button"
        onClick={handleLikeClick}
        disabled={loading}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary disabled:opacity-50"
        aria-pressed={liked}
        aria-label={liked ? "いいねを解除" : "いいね"}
      >
        <span className="text-xl" aria-hidden="true">{liked ? "♥" : "♡"}</span>
        <span>{likesCount}</span>
      </button>
      <Link
        href={detailHref || `/posts/${encodeURIComponent(post.id)}`}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary"
        aria-label="コメント"
      >
        <span className="text-xl" aria-hidden="true">💬</span>
        <span>{post.commentsCount}</span>
      </Link>
      <button
        type="button"
        onClick={handleBookmarkClick}
        disabled={bookmarkLoading}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary disabled:opacity-50"
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? "ブックマークを解除" : "ブックマーク"}
      >
        <span className="text-xl" aria-hidden="true">{isBookmarked ? "🔖" : "🏷"}</span>
      </button>
      {post.visibility === "private" && (
        <span className="flex min-h-11 items-center text-xl text-text-muted" aria-label="非公開">🔒</span>
      )}
    </>
  );

  return (
    <PostCard
      author={{ name: authorName, handle: authorHandle, avatarSrc }}
      authorHref={authorHref}
      time={post.createdAt ? formatTimeAgo(post.createdAt) : ""}
      body={post.content}
      images={images.length > 0 ? images : undefined}
      reactions={reactions}
      className={className}
    />
  );
}
