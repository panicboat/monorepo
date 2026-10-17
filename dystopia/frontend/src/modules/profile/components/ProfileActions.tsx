"use client";

import { Button } from "@/components/ui/button";
import { StartChatButton } from "@/modules/messaging";
import { ProfileMoreMenu, useFollow } from "@/modules/social";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";

interface ProfileActionsProps {
  targetProfileId: string;
  isPrivate: boolean;
}

export function ProfileActions({ targetProfileId, isPrivate }: ProfileActionsProps) {
  const viewerId = useAuthStore(selectActiveProfileId);
  const viewerRole = useAuthStore(selectRole);
  const { isFollowing, isPending, follow, unfollow, cancelRequest, loading } = useFollow(targetProfileId);

  if (!targetProfileId || (viewerId && viewerId === targetProfileId)) return null;

  const onUnfollow = async () => {
    if (!confirm("フォローを解除しますか?")) return;
    await unfollow();
  };

  const onCancelRequest = async () => {
    if (!confirm("フォロー申請をキャンセルしますか?")) return;
    await cancelRequest();
  };

  if (isFollowing) {
    return (
      <>
        <ProfileMoreMenu targetProfileId={targetProfileId} onUnfollow={onUnfollow} />
        <StartChatButton targetProfileId={targetProfileId} variant="primary" />
      </>
    );
  }

  const canMessage = viewerRole === "cast" && !isPrivate;

  return (
    <>
      <ProfileMoreMenu targetProfileId={targetProfileId} />
      {canMessage && <StartChatButton targetProfileId={targetProfileId} variant="secondary" />}
      {isPending ? (
        <Button variant="secondary" size="sm" onClick={onCancelRequest} disabled={loading}>
          申請中
        </Button>
      ) : (
        <Button variant="primary" size="sm" onClick={() => void follow()} disabled={loading}>
          {isPrivate ? "フォロー申請" : "フォロー"}
        </Button>
      )}
    </>
  );
}
