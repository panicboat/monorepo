"use client";

import Link from "next/link";
import { Bookmark, Heart, MessageCircle, Pin, Repeat2, Trash2 } from "lucide-react";
import { PostCard } from "@/components/ui/post-card";
import { profileDisplayName, profileInitial } from "@/components/ui/profile-name";
import { formatTimeAgo } from "@/lib/utils/date";
import { formatMonthDayTimeInJapan } from "@/lib/utils/japan-date";
import { isPlainClick } from "@/lib/utils/isPlainClick";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { useQuoteComposeStore } from "@/stores/quoteComposeStore";
import { usePostCommentCountStore } from "@/stores/postCommentCountStore";
import { usePostDeletionStore } from "@/stores/postDeletionStore";
import { useToastStore } from "@/stores/toastStore";
import { selectActiveProfileId, useAuthStore } from "@/stores/authStore";
import { PostText } from "@/modules/post/lib/post-text";
import { PostScheduleCard } from "./PostScheduleCard";
import { QuoteFrame } from "./QuoteFrame";
import { displayStateOf } from "@/modules/post/lib/display-window";
import { isQuotable } from "@/modules/post/lib/quotable";
import type { PostView } from "@/modules/post/lib/post-view";
import { useDeletePost } from "@/modules/post/hooks/useDeletePost";
import { usePinPost } from "@/modules/post/hooks/usePinPost";
import { usePostLike } from "@/modules/post/hooks/usePostLike";
import { useBookmark } from "@/modules/bookmarks";

export interface PostCardBindingProps {
  post: PostView;
  detailHref?: string;
  inDetail?: boolean;
  showPinMark?: boolean;
  hideQuoteFrame?: boolean;
  className?: string;
}

export function PostCardBinding({ post, detailHref, inDetail, showPinMark, hideQuoteFrame, className }: PostCardBindingProps) {
  const { isLiked, getLikesCount, toggleLike, loading } = usePostLike();
  const { isBookmarked, toggle: toggleBookmark, loading: bookmarkLoading } = useBookmark(post.id);
  const { deletePost, submitting: deleting } = useDeletePost();
  const { pinned, togglePin, submitting: pinning } = usePinPost(post);
  const deleted = usePostDeletionStore((s) => !!s.deleted[post.id]);
  const closeSheet = usePostSheetStore((s) => s.close);
  const openQuote = useQuoteComposeStore((s) => s.openQuote);
  const showToast = useToastStore((s) => s.show);

  const liked = isLiked(post.id, post.liked);
  const likesCount = getLikesCount(post.id, post.likesCount);
  const commentsCount = usePostCommentCountStore((s) => s.counts[post.id]) ?? post.commentsCount;

  const viewerId = useAuthStore(selectActiveProfileId);
  const isOwnPost = !!viewerId && viewerId === post.authorProfileId;
  const displayState = isOwnPost ? displayStateOf(post) : "live";
  const statusMark =
    displayState === "scheduled"
      ? `予約 ${formatMonthDayTimeInJapan(post.publishedAt)} から`
      : displayState === "expired"
        ? "表示終了"
        : undefined;
  const postedAt = post.publishedAt || post.createdAt;

  const authorName = profileDisplayName(post.author);
  const authorHandle = post.author?.username ?? "";
  const avatarSrc = post.author?.avatarUrl || undefined;
  const authorHref = post.author?.username
    ? `/u/${encodeURIComponent(post.author.username)}`
    : undefined;

  const announcementOnly = !!post.schedule && post.content.trim() === "";

  const images = post.media
    .filter((m) => m.mediaType === "image")
    .map((m) => ({ thumbnailUrl: m.thumbnailUrl || m.url, url: m.url || m.thumbnailUrl }))
    .filter((image) => image.thumbnailUrl.length > 0);

  const videos = post.media.filter((m) => m.mediaType === "video" && m.url.length > 0).map((m) => ({ url: m.url }));

  const href = detailHref || `/posts/${encodeURIComponent(post.id)}`;
  const openPost = usePostSheetStore((s) => s.openPost);
  const openDetail = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    openPost(post.id);
  };

  const openQuotes = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    openPost(post.id, "quotes");
  };

  const handleLikeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleLike(post.id, liked).catch(() => showToast("いいねできませんでした"));
  };

  const handleQuoteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!usePostSheetStore.getState().open) {
      openQuote(post);
      return;
    }
    // Open after the detail's async history.back() lands: pushing first would let that back dismiss the composer.
    window.addEventListener("popstate", () => openQuote(post), { once: true });
    closeSheet();
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleBookmark().catch(() => showToast("ブックマークできませんでした"));
  };

  const handlePinClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    togglePin().catch(() => showToast("ピン留めを変更できませんでした"));
  };

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("この投稿を削除しますか?")) return;
    try {
      await deletePost(post.id);
      if (inDetail) closeSheet();
    } catch {
      showToast("投稿を削除できませんでした");
    }
  };

  if (deleted) return null;

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
        <Heart className={liked ? "size-5 fill-current text-accent" : "size-5"} />
        <span>{likesCount}</span>
      </button>
      {inDetail ? (
        <span
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm"
          aria-label={`コメント ${commentsCount} 件`}
        >
          <MessageCircle className="size-5" aria-hidden="true" />
          <span>{commentsCount}</span>
        </span>
      ) : (
        <Link
          href={href}
          onClick={openDetail}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary"
          aria-label="コメント"
        >
          <MessageCircle className="size-5" />
          <span>{commentsCount}</span>
        </Link>
      )}
      <button
        type="button"
        onClick={handleQuoteClick}
        disabled={!isQuotable(post)}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary disabled:opacity-50"
        aria-label="引用する"
      >
        <Repeat2 className="size-5" />
      </button>
      {inDetail ? (
        <span
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm"
          aria-label={`引用 ${post.quotesCount} 件`}
        >
          {post.quotesCount}
        </span>
      ) : (
        <Link
          href={`/posts/${encodeURIComponent(post.id)}?tab=quotes`}
          onClick={openQuotes}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary"
          aria-label={`引用 ${post.quotesCount} 件`}
        >
          {post.quotesCount}
        </Link>
      )}
      <button
        type="button"
        onClick={handleBookmarkClick}
        disabled={bookmarkLoading}
        className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary disabled:opacity-50"
        aria-pressed={isBookmarked}
        aria-label={isBookmarked ? "ブックマークを解除" : "ブックマーク"}
      >
        <Bookmark className={isBookmarked ? "size-5 fill-current text-accent" : "size-5"} />
      </button>
      {isOwnPost && (
        <button
          type="button"
          onClick={handlePinClick}
          disabled={pinning}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-text-primary disabled:opacity-50"
          aria-pressed={pinned}
          aria-label={pinned ? "ピン留めを外す" : "ピン留めする"}
        >
          <Pin className={pinned ? "size-5 fill-current text-accent" : "size-5"} />
        </button>
      )}
      {isOwnPost && (
        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={deleting}
          className="flex min-h-11 min-w-11 items-center justify-center gap-1 text-sm hover:text-error disabled:opacity-50"
          aria-label="投稿を削除"
        >
          <Trash2 className="size-5" />
        </button>
      )}
    </>
  );

  return (
    <PostCard
      author={{ name: authorName, initial: profileInitial(post.author), handle: authorHandle, avatarSrc, isPrivate: !!post.author?.isPrivate }}
      authorHref={authorHref}
      detailHref={inDetail ? undefined : href}
      onDetailClick={inDetail ? undefined : openDetail}
      time={postedAt && displayState !== "scheduled" ? formatTimeAgo(postedAt) : ""}
      statusMark={statusMark}
      pinMark={!!showPinMark && pinned}
      isPrivate={post.visibility === "private"}
      body={announcementOnly ? undefined : <PostText content={post.content} mentions={post.mentions} hashtags={post.hashtags} />}
      attachment={post.schedule && <PostScheduleCard schedule={post.schedule} author={post.author} />}
      images={images.length > 0 ? images : undefined}
      videos={videos.length > 0 ? videos : undefined}
      quoteFrame={post.quotedPost && !hideQuoteFrame ? <QuoteFrame quoted={post.quotedPost} interactive /> : undefined}
      reactions={reactions}
      className={className}
    />
  );
}
