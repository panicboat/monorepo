"use client";

import Link from "next/link";
import { PostCard } from "@/components/ui/post-card";
import { formatTimeAgo } from "@/lib/utils/date";
import { PostText } from "@/modules/post/lib/post-text";
import type { PostView } from "@/modules/post/lib/post-view";
import { usePostLike } from "@/modules/post/hooks/usePostLike";
import { useBookmark } from "@/modules/bookmarks";

export interface PostCardBindingProps {
  post: PostView;
  detailHref?: string;
  className?: string;
}

export function PostCardBinding({ post, detailHref, className }: PostCardBindingProps) {
  const { isLiked, getLikesCount, toggleLike, loading } = usePostLike();
  const { isBookmarked, toggle: toggleBookmark, loading: bookmarkLoading } = useBookmark(post.id);

  const liked = isLiked(post.id, post.liked);
  const likesCount = getLikesCount(post.id, post.likesCount);

  const authorName = post.author?.displayName || "名無し";
  const authorHandle = post.author?.username || post.authorProfileId.slice(0, 8);
  const avatarSrc = post.author?.avatarUrl || undefined;
  const authorHref = post.author?.username
    ? `/u/${encodeURIComponent(post.author.username)}`
    : undefined;

  const images = post.media
    .filter((m) => m.mediaType === "image")
    .map((m) => ({ thumbnailUrl: m.thumbnailUrl || m.url, url: m.url || m.thumbnailUrl }))
    .filter((image) => image.thumbnailUrl.length > 0);

  const href = detailHref || `/posts/${encodeURIComponent(post.id)}`;

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
        href={href}
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
    </>
  );

  return (
    <PostCard
      author={{ name: authorName, handle: authorHandle, avatarSrc }}
      authorHref={authorHref}
      detailHref={href}
      time={post.createdAt ? formatTimeAgo(post.createdAt) : ""}
      isPrivate={post.visibility === "private"}
      body={<PostText content={post.content} mentions={post.mentions} hashtags={post.hashtags} />}
      images={images.length > 0 ? images : undefined}
      reactions={reactions}
      className={className}
    />
  );
}
