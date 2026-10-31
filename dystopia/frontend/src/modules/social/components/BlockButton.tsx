"use client";

import { Button } from "@/components/ui/button";
import { useBlock } from "@/modules/social/hooks";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { toastOnFailure } from "@/stores/toastStore";

interface BlockButtonProps {
  targetProfileId: string;
  className?: string;
}

export function BlockButton({ targetProfileId, className }: BlockButtonProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const { isBlocked, toggle, loading } = useBlock(targetProfileId);

  if (!targetProfileId || (viewerId && viewerId === targetProfileId)) return null;

  const onToggle = () => {
    void toggle().catch(toastOnFailure(isBlocked ? "ブロックを解除できませんでした" : "ブロックできませんでした"));
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onToggle}
      disabled={loading}
      className={className}
    >
      {isBlocked ? "ブロック解除" : "ブロック"}
    </Button>
  );
}
