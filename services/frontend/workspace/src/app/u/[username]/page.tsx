"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { usePublicProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { FollowButton, BlockButton, useSocialCounts } from "@/modules/social";
import { StartChatButton } from "@/modules/messaging";
import { ProfileContentTabs } from "@/modules/post/components/ProfileContentTabs";
import { useRecordVisit } from "@/modules/footprints";
import { useAuthStore, selectUserId } from "@/stores/authStore";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const { profile, loading, error } = usePublicProfile(username || null);
  const counts = useSocialCounts(profile?.accountId);
  const viewerId = useAuthStore(selectUserId);
  const recordVisit = useRecordVisit();

  useEffect(() => {
    if (!viewerId || !profile?.accountId) return;
    if (viewerId === profile.accountId) return;
    recordVisit(profile.accountId);
  }, [viewerId, profile?.accountId, recordVisit]);

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">プロフィールが見つかりませんでした。</main>;
  }

  const role =
    profile.industry || profile.age > 0 || profile.heightCm > 0 || profile.cupSize || profile.areas.length > 0
      ? "cast"
      : "guest";

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader profile={profile} role={role} />
      <div className="flex items-center gap-2 px-4 pt-3">
        <FollowButton targetAccountId={profile.accountId} />
        <StartChatButton targetAccountId={profile.accountId} />
        <BlockButton targetAccountId={profile.accountId} />
      </div>
      <div className="flex gap-4 px-4 pt-3 text-sm text-text-secondary">
        <span>
          <strong className="text-text-primary">{counts.followingCount}</strong> フォロー中
        </span>
        <span>
          <strong className="text-text-primary">{counts.followersCount}</strong> フォロワー
        </span>
      </div>
      <ProfileContentTabs accountId={profile.accountId} />
    </main>
  );
}
