"use client";

import * as React from "react";
import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { videoSrcWithFrame } from "@/modules/media/lib/video-thumbnail";

export interface PostCardImage {
  thumbnailUrl: string;
  url: string;
}

export interface PostCardVideo {
  url: string;
  thumbnailUrl?: string;
}

export interface MediaGalleryProps {
  images?: PostCardImage[];
  videos?: PostCardVideo[];
}

export function MediaGallery({ images, videos }: MediaGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = React.useState<number | null>(null);
  const shownImages = images?.slice(0, 4) ?? [];

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
    <>
      {videos?.map((video) => (
        // With a poster nothing loads until play, and without one only the metadata does: a feed of full video files would download every one.
        <video
          key={video.url}
          src={video.thumbnailUrl ? video.url : videoSrcWithFrame(video.url)}
          poster={video.thumbnailUrl || undefined}
          controls
          playsInline
          preload={video.thumbnailUrl ? "none" : "metadata"}
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
                className="absolute right-4 top-4 rounded-full bg-black/40 p-2 text-white hover:bg-black/60"
              >
                <X className="size-5" />
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
    </>
  );
}
