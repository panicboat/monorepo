"use client";

import { useRef, useState } from "react";
import { useViewScope } from "@/lib/hooks/useViewScope";
import { useToastStore } from "@/stores/toastStore";
import { cn } from "@/lib/utils";
import { useMediaUpload } from "@/modules/profile/hooks/useMediaUpload";

interface ImageUploadProps {
  shape: "avatar" | "cover";
  url?: string;
  onUploaded: (mediaId: string, url: string) => void | Promise<void>;
}

export function ImageUpload({ shape, url, onUploaded }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { upload, uploading, error: uploadError } = useMediaUpload();
  const { capture } = useViewScope(true);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    const request = capture();
    setError(null);
    setAssigning(true);
    try {
      const res = await upload(file);
      if (res && request.isCurrent()) await onUploaded(res.mediaId, res.url);
    } catch (cause) {
      // FALLBACK: Upload adapters can reject without an Error carrying a display message.
      const message = cause instanceof Error ? cause.message : "画像を保存できませんでした";
      if (request.isCurrent()) setError(message);
      else if (request.isSameActor()) useToastStore.getState().show(message);
    } finally {
      if (request.isSameActor() && request.isMounted()) setAssigning(false);
      input.value = "";
    }
  };

  return (
    <div><button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={uploading || assigning}
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
      <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100">
        {uploading || assigning ? "アップロード中…" : "変更"}
      </span>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </button>{(error || uploadError) && <p role="alert" className="mt-2 text-sm text-error">{error || uploadError}</p>}</div>
  );
}
