"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth";
import { useAuthStore, selectUserId, selectRole } from "@/stores/authStore";
import { useFollow } from "@/modules/social/hooks";
import type { ThreadView } from "@/modules/messaging/types";

interface StartChatButtonProps {
  targetAccountId: string;
  className?: string;
}

interface GetOrCreateThreadResponse {
  thread: ThreadView | null;
}

export function StartChatButton({ targetAccountId, className }: StartChatButtonProps) {
  const router = useRouter();
  const viewerId = useAuthStore(selectUserId);
  const viewerRole = useAuthStore(selectRole);
  const { isFollowing } = useFollow(targetAccountId);
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await authFetch<GetOrCreateThreadResponse>("/api/messaging/threads", {
        method: "POST",
        body: { recipientAccountId: targetAccountId },
      });
      if (res.thread?.id) {
        router.push(`/messages/${encodeURIComponent(res.thread.id)}`);
      } else {
        alert("メッセージスレッドの作成に失敗しました");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "メッセージを送れません";
      alert(message || "フォロー関係が条件を満たしていない可能性があります");
    } finally {
      setLoading(false);
    }
  }, [targetAccountId, loading, router]);

  if (!targetAccountId || !viewerId || viewerId === targetAccountId) return null;
  if (viewerRole === "guest" && !isFollowing) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {loading ? "起動中…" : "メッセージを送る"}
    </Button>
  );
}
