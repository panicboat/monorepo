"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { usePublicProfile, useProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { EditProfileSheet } from "@/modules/profile/components/EditProfileSheet";
import { ProfileActions } from "@/modules/profile/components/ProfileActions";
import { SocialCountsLinks } from "@/modules/social";
import { ProfileContentTabs } from "@/modules/post/components/ProfileContentTabs";
import { useRecordVisit } from "@/modules/footprints";
import { useAuthStore, selectActiveProfileId, selectRole } from "@/stores/authStore";
import { GuestKarteTab } from "@/modules/karte/components/GuestKarteTab";
import { CastReviewsTab } from "@/modules/review/components/CastReviewsTab";
import { AuthorReviewsTab } from "@/modules/review/components/AuthorReviewsTab";
import { ScheduleTab } from "@/modules/schedule";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { Button } from "@/components/ui/button";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const initialTab = useSearchParams()?.get("tab") ?? undefined;
  const username = typeof params.username === "string" ? params.username : "";
  const { profile, loading, error, mutate } = usePublicProfile(username || null);
  const viewerId = useAuthStore(selectActiveProfileId);
  const recordVisit = useRecordVisit();
  const viewerRole = useAuthStore(selectRole);
  const { saveProfile, saveMedia } = useProfile();
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [editing, setEditing] = useState<{ session: number; open: boolean } | null>(null);

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
  const guestView: ProfileSummaryView = {
    profileId: profile.id,
    username: profile.username,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    isPrivate: profile.isPrivate,
    role: "guest",
    industry: profile.industry,
  };

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader
        profile={profile}
        role={role}
        actions={
          isOwnProfile ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}>
              プロフィールを編集
            </Button>
          ) : (
            <ProfileActions targetProfileId={profile.id} />
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
                { id: "schedule", label: "予定", content: <ScheduleTab profileId={profile.id} isOwner={isOwnProfile} /> },
                {
                  id: "reviews",
                  label: "クチコミ",
                  content: <CastReviewsTab cast={{ ...guestView, role: "cast" }} />,
                },
              ]
            : viewerRole === "cast"
              ? [{ id: "karte", label: "カルテ", content: <GuestKarteTab guest={guestView} /> }]
              : []
        }
        extraTabs={
          role === "guest"
            ? [{ id: "reviews", label: "クチコミ", content: <AuthorReviewsTab authorProfileId={profile.id} /> }]
            : []
        }
        initialTab={initialTab}
      />
      {isOwnProfile && editing && (
        <EditProfileSheet
          key={editing.session}
          open={editing.open}
          onOpenChange={(open) => setEditing((current) => current && { ...current, open })}
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
