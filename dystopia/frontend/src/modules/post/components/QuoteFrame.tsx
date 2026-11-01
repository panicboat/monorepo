"use client";

import Image from "next/image";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { LockMark } from "@/components/ui/lock-mark";
import { profileDisplayName, profileInitial } from "@/components/ui/profile-name";
import { formatTimeAgo } from "@/lib/utils/date";
import { isPlainClick } from "@/lib/utils/isPlainClick";
import { cn } from "@/lib/utils";
import { PostText } from "@/modules/post/lib/post-text";
import type { QuotedPostView } from "@/modules/post/lib/post-view";
import { ScheduleSummary } from "@/modules/schedule/components/ScheduleSummary";
import { usePostSheetStore } from "@/stores/postSheetStore";

export interface QuoteFrameProps {
  quoted: QuotedPostView;
  interactive?: boolean;
}

const FRAME = "block rounded-md border border-border p-3";
const MAX_TILES = 4;

export function QuoteFrame({ quoted, interactive }: QuoteFrameProps) {
  const openPost = usePostSheetStore((s) => s.openPost);

  if (!quoted.available) {
    return <div className={cn(FRAME, "bg-bg-elevated text-sm text-text-secondary")}>この投稿は表示できません</div>;
  }

  const { author } = quoted;
  const tiles = quoted.media
    .map((m) => ({ id: m.id, isVideo: m.mediaType === "video", src: m.mediaType === "video" ? m.thumbnailUrl : m.thumbnailUrl || m.url }))
    .filter((tile) => tile.isVideo || tile.src.length > 0)
    .slice(0, MAX_TILES);

  // Plain text when not interactive: PostText's inline links push a route and would close the composer sheet.
  const content = (
    <>
      <div className="flex items-center gap-2 text-sm">
        <Avatar src={author?.avatarUrl || undefined} fallback={profileInitial(author)} size="sm" />
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate font-bold text-text-primary">{profileDisplayName(author)}</span>
          {author?.isPrivate && <LockMark label="鍵付き" className="text-xs" />}
          {author?.username && <span className="truncate text-text-secondary">@{author.username}</span>}
        </span>
        {quoted.publishedAt && <span className="shrink-0 text-text-muted">· {formatTimeAgo(quoted.publishedAt)}</span>}
      </div>
      {quoted.content.trim() !== "" && (
        <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-text-primary">
          {interactive ? <PostText content={quoted.content} mentions={quoted.mentions} hashtags={quoted.hashtags} /> : quoted.content}
        </p>
      )}
      {quoted.schedule && (
        <ScheduleSummary
          workDate={quoted.schedule.workDate}
          startTime={quoted.schedule.startTime}
          endTime={quoted.schedule.endTime}
          industry={author?.industry ?? ""}
        />
      )}
      {tiles.length > 0 && (
        <div className={cn("mt-2 grid gap-1 overflow-hidden rounded-md", tiles.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
          {tiles.map((tile) => (
            <div key={tile.id} className="relative aspect-video w-full bg-surface">
              {tile.src ? (
                <Image src={tile.src} alt="" fill sizes="(min-width: 640px) 240px, 40vw" className="object-cover" />
              ) : (
                <span className="flex size-full items-center justify-center text-sm text-text-secondary">動画</span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (!interactive) return <div className={FRAME}>{content}</div>;

  return (
    <Link
      href={`/posts/${encodeURIComponent(quoted.id)}`}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        openPost(quoted.id);
      }}
      className={cn(FRAME, "hover:border-accent/60")}
    >
      {content}
    </Link>
  );
}
