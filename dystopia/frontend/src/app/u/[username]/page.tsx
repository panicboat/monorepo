"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { usePublicProfile, useProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { EditProfileSheet } from "@/modules/profile/components/EditProfileSheet";
import { FollowButton, ProfileMoreMenu, SocialCountsLinks } from "@/modules/social";
import { StartChatButton } from "@/modules/messaging";
import { ProfileContentTabs } from "@/modules/post/components/ProfileContentTabs";
import { useRecordVisit } from "@/modules/footprints";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";
import { GuestKarteTab } from "@/modules/karte/components/GuestKarteTab";
import { ReviewsTab } from "@/modules/review/components/ReviewsTab";
import { ScheduleTab, WeeklyScheduleSummary } from "@/modules/schedule";
import type { SocialProfileView } from "@/modules/social/types";
import { Button } from "@/components/ui/button";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const { profile, loading, error, mutate } = usePublicProfile(username || null);
  const viewerId = useAuthStore(selectActiveProfileId);
  const recordVisit = useRecordVisit();
  const viewerRole = useAuthStore(selectRole);
  const { saveProfile, saveMedia } = useProfile();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!viewerId || !profile?.id) return;
    if (viewerId === profile.id) return;
    recordVisit(profile.id);
  }, [viewerId, profile?.id, recordVisit]);

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">プロフィールが見つかりませんでした。</main>;
  }

  const role = profile.role === 2 ? "cast" : "guest";
  const isOwnProfile = !!viewerId && viewerId === profile.id;
  const guestView: SocialProfileView = {
    profileId: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isPrivate: profile.isPrivate,
    role: "guest",
  };

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader
        profile={profile}
        role={role}
        actions={
          isOwnProfile ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              プロフィールを編集
            </Button>
          ) : (
            <>
              <ProfileMoreMenu targetProfileId={profile.id} />
              <StartChatButton targetProfileId={profile.id} />
              <FollowButton targetProfileId={profile.id} />
            </>
          )
        }
      />
      <SocialCountsLinks profileId={profile.id} username={profile.username} />
      <ProfileContentTabs
        profileId={profile.id}
        isOwnProfile={isOwnProfile}
        leadingTabs={
          role === "cast"
            ? [
                { id: "schedule", label: "出勤", content: <ScheduleTab profileId={profile.id} isOwner={isOwnProfile} /> },
                {
                  id: "reviews",
                  label: "レビュー",
                  content: <ReviewsTab profileId={profile.id} mode="received" target={{ ...guestView, role: "cast" }} />,
                },
              ]
            : viewerRole === "cast"
              ? [{ id: "karte", label: "カルテ", content: <GuestKarteTab guest={guestView} /> }]
              : []
        }
        extraTabs={
          role === "guest"
            ? [{ id: "reviews", label: "レビュー", content: <ReviewsTab profileId={profile.id} mode="written" /> }]
            : []
        }
        renderAboveTabs={
          role === "cast"
            ? (tab, selectTab) =>
                tab === "schedule" ? null : (
                  <WeeklyScheduleSummary profileId={profile.id} onShowMore={() => selectTab("schedule")} />
                )
            : undefined
        }
      />
      {isOwnProfile && (
        <EditProfileSheet
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
