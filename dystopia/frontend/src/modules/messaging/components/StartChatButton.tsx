"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";
import { useFollow } from "@/modules/social/hooks";
import { useStartChat } from "@/modules/messaging/hooks/useStartChat";

interface StartChatButtonProps {
  targetProfileId: string;
  className?: string;
}

export function StartChatButton({ targetProfileId, className }: StartChatButtonProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const viewerRole = useAuthStore(selectRole);
  const { isFollowing } = useFollow(targetProfileId);
  const { start, loading } = useStartChat();

  const onClick = useCallback(async () => {
    if (loading) return;
    try {
      await start(targetProfileId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "メッセージを送れません";
      alert(message || "フォロー関係が条件を満たしていない可能性があります");
    }
  }, [targetProfileId, loading, start]);

  if (!targetProfileId || !viewerId || viewerId === targetProfileId) return null;
  if (viewerRole === "guest" && !isFollowing) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {loading ? "起動中…" : "メッセージ"}
    </Button>
  );
}
