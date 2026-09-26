"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicProfile, useProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { EditProfileModal } from "@/modules/profile/components/EditProfileModal";
import { FollowButton, BlockButton, useSocialCounts } from "@/modules/social";
import { StartChatButton } from "@/modules/messaging";
import { ProfileContentTabs } from "@/modules/post/components/ProfileContentTabs";
import { useRecordVisit } from "@/modules/footprints";
import { useAuthStore, selectUserId } from "@/stores/authStore";
import { useMyKarteAccess } from "@/modules/karte/hooks/useMyKarteAccess";
import { GuestKarteTab } from "@/modules/karte/components/GuestKarteTab";
import { ReviewsTab } from "@/modules/review/components/ReviewsTab";
import { ScheduleSection } from "@/modules/schedule";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const { profile, loading, error, mutate } = usePublicProfile(username || null);
  const counts = useSocialCounts(profile?.accountId);
  const viewerId = useAuthStore(selectUserId);
  const recordVisit = useRecordVisit();
  const { hasAccess: karteAccess } = useMyKarteAccess();
  // useProfile() piggybacks on the SWR cache SideNav/Drawer already populate for the viewer's own profile.
  const { saveProfile, saveMedia } = useProfile();
  const [editing, setEditing] = useState(false);

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

  // 2 = CAST per identity__users.role, mirrored onto profile.role by the
  // monolith presenter. 0 (unknown) is treated as guest so the karte tab
  // stays hidden until identity is fully resolved.
  const role = profile.role === 2 ? "cast" : "guest";
  const isOwnProfile = !!viewerId && viewerId === profile.accountId;

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader profile={profile} role={role} onEdit={isOwnProfile ? () => setEditing(true) : undefined} />
      {!isOwnProfile && (
        <div className="flex items-center gap-2 px-4 pt-3">
          <FollowButton targetAccountId={profile.accountId} />
          <StartChatButton targetAccountId={profile.accountId} />
          <BlockButton targetAccountId={profile.accountId} />
        </div>
      )}
      <div className="flex gap-4 px-4 pt-3 text-sm text-text-secondary">
        <span>
          <strong className="text-text-primary">{counts.followingCount}</strong> フォロー中
        </span>
        <span>
          <strong className="text-text-primary">{counts.followersCount}</strong> フォロワー
        </span>
      </div>
      {role === "cast" && <ScheduleSection accountId={profile.accountId} isOwner={isOwnProfile} />}
      <ProfileContentTabs
        accountId={profile.accountId}
        isOwnProfile={isOwnProfile}
        extraTabs={[
          ...(role === "guest" && karteAccess
            ? [{ id: "karte", label: "カルテ", content: <GuestKarteTab guestAccountId={profile.accountId} /> }]
            : []),
          {
            id: "reviews",
            label: role === "cast" ? "受信レビュー" : "書いたレビュー",
            content: (
              <ReviewsTab
                accountId={profile.accountId}
                mode={role === "cast" ? "received" : "written"}
              />
            ),
          },
        ]}
      />
      {isOwnProfile && (
        <EditProfileModal
          open={editing}
          onOpenChange={setEditing}
          profile={profile}
          isCast={role === "cast"}
          onSave={async (payload) => {
            await saveProfile(payload);
            await mutate();
          }}
          onSaveMedia={async (payload) => {
            await saveMedia(payload);
            await mutate();
          }}
        />
      )}
    </main>
  );
}
