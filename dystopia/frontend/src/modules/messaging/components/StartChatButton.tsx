"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { useStartChat } from "@/modules/messaging/hooks/useStartChat";

interface StartChatButtonProps {
  targetProfileId: string;
  variant?: "primary" | "secondary";
  className?: string;
}

export function StartChatButton({ targetProfileId, variant = "secondary", className }: StartChatButtonProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
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

  return (
    <Button
      variant={variant}
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {loading ? "起動中…" : "メッセージ"}
    </Button>
  );
}
