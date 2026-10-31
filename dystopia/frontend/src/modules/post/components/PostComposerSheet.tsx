"use client";

import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { SideSheet } from "@/components/ui/side-sheet";
import { PostComposer } from "./PostComposer";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { usePostFeedStore } from "@/stores/postFeedStore";
import { useToastStore } from "@/stores/toastStore";
import { formatMonthDayTimeInJapan } from "@/lib/utils/japan-date";
import { revalidatePostLists } from "../lib/revalidate";

interface PostComposerSheetProps {
  open: boolean;
  onClose: () => void;
}

export function PostComposerSheet({ open, onClose }: PostComposerSheetProps) {
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((s) => s.notifyPostCreated);
  const showToast = useToastStore((s) => s.show);

  const handleSubmit = useCallback(async (payload: SavePostPayload) => {
    await authFetch("/api/posts", { method: "POST", body: payload });
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    void revalidatePostLists();
    notifyPostCreated();
    if (payload.publishedAt && new Date(payload.publishedAt) > new Date()) {
      showToast(`予約しました（${formatMonthDayTimeInJapan(payload.publishedAt)} から表示。プロフィールで確認できます）`);
    } else {
      showToast("投稿しました");
    }
    onClose();
  }, [mutate, notifyPostCreated, showToast, onClose]);

  return (
    <SideSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="投稿を作成">
      <PostComposer onSubmit={handleSubmit} />
    </SideSheet>
  );
}
