"use client";

import * as React from "react";
import Link from "next/link";
import { Pin, Users } from "lucide-react";
import { Avatar } from "./avatar";
import { LockMark } from "./lock-mark";
import { MediaGallery, type PostCardImage, type PostCardVideo } from "./media-gallery";
import { cn } from "@/lib/utils";

export type { PostCardImage, PostCardVideo };

export interface PostCardProps {
  author: { name: string; initial?: string; handle: string; avatarSrc?: string; isPrivate?: boolean };
  authorHref?: string;
  detailHref?: string;
  onDetailClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  time: string;
  isPrivate?: boolean;
  statusMark?: string;
  pinMark?: boolean;
  headerAction?: React.ReactNode;
  body?: React.ReactNode;
  attachment?: React.ReactNode;
  images?: PostCardImage[];
  videos?: PostCardVideo[];
  quoteFrame?: React.ReactNode;
  reactions?: React.ReactNode;
  className?: string;
}

export function PostCard({
  author,
  authorHref,
  detailHref,
  onDetailClick,
  time,
  isPrivate,
  statusMark,
  pinMark,
  headerAction,
  body,
  attachment,
  images,
  videos,
  quoteFrame,
  reactions,
  className,
}: PostCardProps) {
  const avatar = <Avatar src={author.avatarSrc} fallback={author.initial ?? author.name.slice(0, 1)} size="md" href={authorHref} />;
  const nameAndHandle = (
    <span className="flex min-w-0 items-center gap-1">
      <span className="truncate font-bold text-text-primary">{author.name}</span>
      {author.isPrivate && <LockMark label="鍵付き" className="shrink-0 text-xs" />}
      {author.handle && <span className="min-w-0 shrink-[100] truncate text-text-secondary">@{author.handle}</span>}
    </span>
  );

  return (
    <article className={cn("border-b border-divider px-4 py-3", className)}>
      {pinMark && (
        <p className="mb-1 flex items-center gap-1 pl-[3.25rem] text-xs text-text-secondary">
          <Pin className="size-3 fill-current" aria-hidden="true" />
          ピン留めされた投稿
        </p>
      )}
      <div className="flex gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            {authorHref ? <Link href={authorHref} className="min-w-0">{nameAndHandle}</Link> : nameAndHandle}
            {time && <span className="shrink-0 text-text-muted">· {time}</span>}
            {statusMark && <span className="shrink-0 text-xs text-text-muted">{statusMark}</span>}
            {isPrivate && (
              <span role="img" aria-label="フォロワーのみ" title="フォロワーのみ" className="inline-flex shrink-0 items-center text-xs">
                <Users className="size-[1em]" />
              </span>
            )}
            {headerAction && <div className="ml-auto shrink-0">{headerAction}</div>}
          </div>
          {body !== undefined &&
            (detailHref ? (
              <Link href={detailHref} onClick={onDetailClick} className="block">
                <p className="mt-1 whitespace-pre-wrap text-text-primary">{body}</p>
              </Link>
            ) : (
              <p className="mt-1 whitespace-pre-wrap text-text-primary">{body}</p>
            ))}
          {attachment}
          <MediaGallery images={images} videos={videos} />
          {quoteFrame && <div className="mt-2">{quoteFrame}</div>}
          {reactions && (
            <div className="mt-3 grid grid-cols-[repeat(3,minmax(0,1fr))_auto] items-center text-text-secondary">
              {reactions}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
