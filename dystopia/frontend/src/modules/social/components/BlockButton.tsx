"use client";

import { Button } from "@/components/ui/button";
import { useBlock } from "@/modules/social/hooks";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";

interface BlockButtonProps {
  targetProfileId: string;
  className?: string;
}

export function BlockButton({ targetProfileId, className }: BlockButtonProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const { isBlocked, block, unblock, loading } = useBlock(targetProfileId);

  if (!targetProfileId || (viewerId && viewerId === targetProfileId)) return null;

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
