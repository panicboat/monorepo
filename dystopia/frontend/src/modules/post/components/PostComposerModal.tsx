"use client";

import { useCallback } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { PostComposer } from "./PostComposer";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { usePostFeedStore } from "@/stores/postFeedStore";

interface PostComposerModalProps {
  open: boolean;
  onClose: () => void;
}

export function PostComposerModal({ open, onClose }: PostComposerModalProps) {
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((s) => s.notifyPostCreated);

  const handleSubmit = useCallback(async (payload: SavePostPayload) => {
    await authFetch("/api/posts", { method: "POST", body: payload });
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    notifyPostCreated();
    onClose();
  }, [mutate, notifyPostCreated, onClose]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content
          aria-label="投稿を作成"
          className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg p-4 shadow-2xl"
        >
          <div className="mb-3 flex items-center justify-between">
            <Dialog.Title className="text-lg font-bold text-text-primary">投稿を作成</Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-full p-1 text-text-secondary hover:bg-bg-secondary hover:text-text-primary"
                aria-label="閉じる"
              >
                ✕
              </button>
            </Dialog.Close>
          </div>
          <PostComposer onSubmit={handleSubmit} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
