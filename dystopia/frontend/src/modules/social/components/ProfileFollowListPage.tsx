"use client";

import { useParams } from "next/navigation";
import { usePublicProfile } from "@/modules/profile/hooks";
import { FollowListView, type FollowListTab } from "./FollowListView";

const HEADINGS: Record<FollowListTab, string> = {
  following: "のフォロー中",
  followers: "のフォロワー",
};

interface ProfileFollowListPageProps {
  initialTab: FollowListTab;
}

export function ProfileFollowListPage({ initialTab }: ProfileFollowListPageProps) {
  const params = useParams<{ username: string }>();
  const username = typeof params.username === "string" ? params.username : "";
  const { profile, loading, error } = usePublicProfile(username || null);

  if (loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">プロフィールが見つかりませんでした。</main>;
  }

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <h1 className="px-4 pb-2 pt-4 text-xl font-bold">
        {profile.displayName}
        {HEADINGS[initialTab]}
      </h1>
      <FollowListView profileId={profile.id} initialTab={initialTab} />
    </main>
  );
}
