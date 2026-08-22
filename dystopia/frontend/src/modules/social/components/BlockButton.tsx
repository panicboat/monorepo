"use client";

import { Button } from "@/components/ui/button";
import { useBlock } from "@/modules/social/hooks";
import { useAuthStore, selectUserId } from "@/stores/authStore";

interface BlockButtonProps {
  targetAccountId: string;
  className?: string;
}

export function BlockButton({ targetAccountId, className }: BlockButtonProps) {
  const viewerId = useAuthStore(selectUserId);
  const { isBlocked, block, unblock, loading } = useBlock(targetAccountId);

  if (!targetAccountId || (viewerId && viewerId === targetAccountId)) return null;

  const onClick = async () => {
    if (isBlocked) {
      if (!confirm("ブロックを解除しますか?")) return;
      await unblock();
    } else {
      if (!confirm("このアカウントをブロックします。よろしいですか?")) return;
      await block();
    }
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={loading}
      className={className}
    >
      {isBlocked ? "ブロック解除" : "ブロック"}
    </Button>
  );
}
