"use client";

import { useCallback, useEffect } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { PostComposer } from "./PostComposer";
import type { SavePostPayload } from "@/modules/post/lib/post-view";

interface PostComposerModalProps {
  open: boolean;
  onClose: () => void;
}

export function PostComposerModal({ open, onClose }: PostComposerModalProps) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleSubmit = useCallback(async (payload: SavePostPayload) => {
    await authFetch("/api/posts", { method: "POST", body: payload });
    // Invalidate any feed/posts list cache so the new post appears on next navigation/refresh.
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    onClose();
  }, [mutate, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="投稿を作成"
        className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-text-primary">投稿を作成</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
            aria-label="閉じる"
          >
            ✕
          </button>
        </div>
        <PostComposer onSubmit={handleSubmit} />
      </div>
    </>
  );
}
