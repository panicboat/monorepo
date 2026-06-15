"use client";

import { useParams } from "next/navigation";
import { usePublicProfile } from "@/modules/profile/hooks";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { FollowButton } from "@/modules/social";

export default function PublicProfilePage() {
  const params = useParams<{ username: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const { profile, loading, error } = usePublicProfile(username || null);

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
      <div className="px-4 pt-3">
        <FollowButton targetAccountId={profile.accountId} />
      </div>
    </main>
  );
}
