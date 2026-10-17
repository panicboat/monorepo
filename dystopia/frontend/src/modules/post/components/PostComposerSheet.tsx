"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { SideSheet } from "@/components/ui/side-sheet";
import { PostComposer } from "./PostComposer";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { usePostFeedStore } from "@/stores/postFeedStore";

interface PostComposerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function PostComposerSheet({ open, onClose }: PostComposerSheetProps) {
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((s) => s.notifyPostCreated);

  const handleSubmit = useCallback(async (payload: SavePostPayload) => {
    await authFetch("/api/posts", { method: "POST", body: payload });
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    notifyPostCreated();
    onClose();
  }, [mutate, notifyPostCreated, onClose]);

  return (
    <SideSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="投稿を作成">
      <PostComposer onSubmit={handleSubmit} />
    </SideSheet>
  );
}
