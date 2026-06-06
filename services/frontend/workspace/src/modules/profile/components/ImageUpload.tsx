"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useMediaUpload } from "@/modules/profile/hooks/useMediaUpload";

interface ImageUploadProps {
  shape: "avatar" | "cover";
  url?: string;
  onUploaded: (mediaId: string, url: string) => void;
}

export function ImageUpload({ shape, url, onUploaded }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading } = useMediaUpload();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const res = await upload(file);
      if (res) onUploaded(res.mediaId, res.url);
    }
    e.target.value = "";
  };

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading}
      className={cn(
        "group relative overflow-hidden border border-border bg-input-bg",
        shape === "avatar" ? "h-20 w-20 rounded-full" : "h-28 w-full rounded-md"
      )}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-xs text-text-muted">
          {shape === "avatar" ? "アバター" : "カバー画像"}
        </span>
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {uploading ? "アップロード中…" : "変更"}
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </button>
  );
}
