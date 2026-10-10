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
  const { isBlocked, toggle, loading } = useBlock(targetProfileId);

  if (!targetProfileId || (viewerId && viewerId === targetProfileId)) return null;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={toggle}
      disabled={loading}
      className={className}
    >
      {isBlocked ? "ブロック解除" : "ブロック"}
    </Button>
  );
}
