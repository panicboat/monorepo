"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { useViewScope } from "@/lib/hooks/useViewScope";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";
import { useFollow } from "@/modules/social/hooks";
import { MessageDraft } from "./MessageDraft";

interface StartChatButtonProps { targetProfileId: string; className?: string; }

export function StartChatButton({ targetProfileId, className }: StartChatButtonProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const viewerRole = useAuthStore(selectRole);
  const { isFollowing } = useFollow(targetProfileId);
  const [open, setOpen] = useState(false);
  const scope = useViewScope(open, targetProfileId);
  const router = useRouter();
  if (!targetProfileId || !viewerId || viewerId === targetProfileId) return null;
  const allowed = viewerRole !== "guest" || isFollowing;
  if (!allowed && !open) return null;
  return <><Button variant="secondary" size="sm" onClick={() => setOpen(true)} disabled={!allowed} className={className}>メッセージ</Button><SideSheet open={open} onOpenChange={setOpen} title="メッセージを作成"><MessageDraft recipientProfileId={targetProfileId} onSent={(threadId) => { if (scope.capture().isCurrent()) router.replace(`/messages/${encodeURIComponent(threadId)}`); }} /></SideSheet></>;
}
