"use client";

import { Button } from "@/components/ui/button";
import { useFollow } from "@/modules/social/hooks";
import { FollowStatus } from "@/modules/social/types";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";

interface FollowButtonProps {
  targetProfileId: string;
  className?: string;
}

export function FollowButton({ targetProfileId, className }: FollowButtonProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const { status, isFollowing, isPending, follow, unfollow, cancelRequest, loading } =
    useFollow(targetProfileId);

  if (!targetProfileId || (viewerId && viewerId === targetProfileId)) return null;

  const onClick = async () => {
    if (isFollowing) {
      if (!confirm("フォローを解除しますか?")) return;
      await unfollow();
    } else if (isPending) {
      if (!confirm("フォロー申請をキャンセルしますか?")) return;
      await cancelRequest();
    } else {
      await follow();
    }
  };

  const label = isFollowing ? "フォロー中" : isPending ? "申請中" : "フォロー";
  const variant = status === FollowStatus.NONE ? "primary" : "secondary";

  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={loading} className={className}>
      {label}
    </Button>
  );
}
