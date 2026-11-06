"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMediaUpload } from "@/modules/media/hooks/useMediaUpload";
import type { UploadedMedia } from "@/modules/media/types";
import { MAX_REVIEW_MEDIA } from "../lib/catalog";
import type { ReviewMedia } from "../types";

interface ReviewEventAttachmentsProps {
  items: ReviewMedia[];
  onChange: (next: ReviewMedia[]) => void;
  onUploadingChange: (uploading: boolean) => void;
  disabled: boolean;
}

const toReviewMedia = (uploaded: UploadedMedia): ReviewMedia => ({
  mediaId: uploaded.mediaId,
  mediaType: uploaded.mediaType,
  url: uploaded.localUrl,
  thumbnailUrl: uploaded.localUrl,
});

export function ReviewEventAttachments({ items, onChange, onUploadingChange, disabled }: ReviewEventAttachmentsProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filenames, setFilenames] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestItems = useRef(items);
  const { uploadMedia } = useMediaUpload();

  useEffect(() => {
    latestItems.current = items;
  });

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_REVIEW_MEDIA - items.length);
    e.target.value = "";
    if (files.length === 0) return;

    setError(null);
    setUploading(true);
    onUploadingChange(true);
    try {
      const uploaded = await Promise.all(files.map((file) => uploadMedia(file, { registerAfterUpload: true })));
      setFilenames((prev) => ({ ...prev, ...Object.fromEntries(uploaded.map((item) => [item.mediaId, item.filename])) }));
      onChange([...latestItems.current, ...uploaded.map(toReviewMedia)]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  };

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2" aria-label="添付したメディア">
          {items.map((item) => {
            const name = filenames[item.mediaId] ?? (item.mediaType === "video" ? "動画" : "画像");
            return (
              <li key={item.mediaId} className="relative h-20 w-20 overflow-hidden rounded-md border border-border">
                {item.mediaType === "video" ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={item.url} className="h-full w-full object-cover" muted />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbnailUrl || item.url} alt={name} className="h-full w-full object-cover" />
                )}
                <button
                  type="button"
                  onClick={() => onChange(items.filter((other) => other.mediaId !== item.mediaId))}
                  disabled={disabled}
                  aria-label={`${name}を削除`}
                  className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <X className="size-3" strokeWidth={2.5} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading || items.length >= MAX_REVIEW_MEDIA}
      >
        {uploading ? "アップロード中…" : "画像/動画を追加"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        aria-label="画像や動画を選択"
        onChange={handleFilesSelected}
      />
      {error && (
        <p className="mt-2 text-sm text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
