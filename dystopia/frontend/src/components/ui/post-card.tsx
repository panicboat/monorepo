"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Avatar } from "./avatar";
import { LockMark } from "./lock-mark";
import { cn } from "@/lib/utils";

export interface PostCardImage {
  thumbnailUrl: string;
  url: string;
}

export interface PostCardVideo {
  url: string;
}

export interface PostCardProps {
  author: { name: string; handle: string; avatarSrc?: string };
  authorHref?: string;
  detailHref?: string;
  time: string;
  isPrivate?: boolean;
  body: React.ReactNode;
  images?: PostCardImage[];
  videos?: PostCardVideo[];
  reactions?: React.ReactNode;
  className?: string;
}

export function PostCard({
  author,
  authorHref,
  detailHref,
  time,
  isPrivate,
  body,
  images,
  videos,
  reactions,
  className,
}: PostCardProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const shownImages = images?.slice(0, 4) ?? [];

  const avatar = <Avatar src={author.avatarSrc} fallback={author.name.slice(0, 1)} size="md" href={authorHref} />;
  const nameAndHandle = (
    <span className="flex items-center gap-1">
      <span className="font-bold text-text-primary">{author.name}</span>
      <span className="text-text-secondary">@{author.handle}</span>
    </span>
  );

  const openLightbox = (i: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLightboxIndex(i);
  };

  const showNextImage = () => {
    setLightboxIndex((i) => (i === null ? i : (i + 1) % shownImages.length));
  };

  const showPreviousImage = () => {
    setLightboxIndex((i) => (i === null ? i : (i - 1 + shownImages.length) % shownImages.length));
  };

  return (
    <article className={cn("border-b border-divider px-4 py-3", className)}>
      <div className="flex gap-3">
        {avatar}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            {authorHref ? <Link href={authorHref}>{nameAndHandle}</Link> : nameAndHandle}
            <span className="text-text-muted">· {time}</span>
            {isPrivate && <LockMark label="非公開" className="text-xs" />}
          </div>
          {detailHref ? (
            <Link href={detailHref} className="block">
              <p className="mt-1 whitespace-pre-wrap text-text-primary">{body}</p>
            </Link>
          ) : (
            <p className="mt-1 whitespace-pre-wrap text-text-primary">{body}</p>
          )}
          {videos?.map((video) => (
            // Load only the metadata: a feed of full video files would download every one before any is played.
            <video
              key={video.url}
              src={video.url}
              controls
              playsInline
              preload="metadata"
              className="mt-2 max-h-[70vh] w-full rounded-md bg-black"
            />
          ))}
          {shownImages.length > 0 && (
            <div
              className={cn(
                "mt-2 grid gap-1 overflow-hidden rounded-md",
                shownImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
              )}
            >
              {shownImages.map((image, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={openLightbox(i)}
                  aria-label="画像を拡大"
                  className="relative aspect-video w-full"
                >
                  <Image
                    src={image.thumbnailUrl}
                    alt=""
                    fill
                    sizes="(min-width: 640px) 320px, 50vw"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
          {reactions && (
            <div className="mt-3 flex items-center gap-6 text-text-secondary">
              {reactions}
            </div>
          )}
        </div>
      </div>

      <Dialog.Root
        open={lightboxIndex !== null}
        onOpenChange={(next) => { if (!next) setLightboxIndex(null); }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
          <Dialog.Content
            className="fixed inset-0 z-50 flex items-center justify-center"
            onClick={() => setLightboxIndex(null)}
          >
            <Dialog.Title className="sr-only">画像を表示</Dialog.Title>
            {lightboxIndex !== null && (
              <div className="relative h-[80vh] w-[92vw]" onClick={(e) => e.stopPropagation()}>
                <Image
                  src={shownImages[lightboxIndex].url}
                  alt=""
                  fill
                  sizes="92vw"
                  className="object-contain"
                />
              </div>
            )}
            <Dialog.Close asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label="閉じる"
                className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-xl text-white hover:bg-black/60"
              >
                ✕
              </button>
            </Dialog.Close>
            {shownImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); showPreviousImage(); }}
                  aria-label="前の画像"
                  className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-xl text-white hover:bg-black/60"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); showNextImage(); }}
                  aria-label="次の画像"
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-xl text-white hover:bg-black/60"
                >
                  ›
                </button>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </article>
  );
}
