"use client";

import { useCallback, useState } from "react";
import { useSWRConfig } from "swr";
import { authFetch } from "@/lib/auth";
import { useViewScope } from "@/lib/hooks/useViewScope";
import { SideSheet } from "@/components/ui/side-sheet";
import { PostComposer } from "./PostComposer";
import type { SavePostPayload } from "@/modules/post/lib/post-view";
import { usePostFeedStore } from "@/stores/postFeedStore";

interface PostComposerModalProps { open: boolean; onClose: () => void; }

export function PostComposerModal({ open, onClose }: PostComposerModalProps) {
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((state) => state.notifyPostCreated);
  const { capture, scopeId } = useViewScope(open);
  const [formId, setFormId] = useState(scopeId);
  if (open && formId !== scopeId) setFormId(scopeId);
  const handleSubmit = useCallback(async (payload: SavePostPayload) => {
    const request = capture();
    if (!request.isCurrent()) return;
    await authFetch("/api/posts", { method: "POST", body: payload });
    if (!request.isSameActor()) return;
    // SILENT: Refresh failures stay with readers after the post has already been saved.
    await mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true, populateCache: false, throwOnError: false });
    notifyPostCreated();
    if (request.isCurrent()) onClose();
  }, [capture, mutate, notifyPostCreated, onClose]);
  return <SideSheet open={open} onOpenChange={(next) => { if (!next) onClose(); }} title="投稿を作成"><PostComposer key={formId} active={open} onSubmit={handleSubmit} className="space-y-4" /></SideSheet>;
}
