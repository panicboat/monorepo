"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { useFollowList, useFollowerList } from "@/modules/social/hooks";
import { FollowButton } from "./FollowButton";
import type { SocialAccountView } from "../types";

export type FollowListTab = "following" | "followers";

const TABS: TabItem[] = [
  { id: "following", label: "フォロー中" },
  { id: "followers", label: "フォロワー" },
];

function ProfileRow({ profile }: { profile: SocialAccountView }) {
  const href = `/u/${encodeURIComponent(profile.username)}`;
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Avatar
        src={profile.avatarUrl || undefined}
        fallback={profile.displayName.slice(0, 1) || "?"}
        size="md"
        href={href}
      />
      <Link href={href} className="min-w-0 flex-1">
        <p className="truncate font-bold text-text-primary">{profile.displayName}</p>
        <p className="truncate text-sm text-text-secondary">@{profile.username}</p>
      </Link>
      <FollowButton targetProfileId={profile.profileId} />
    </div>
  );
}

interface FollowListViewProps {
  profileId?: string;
  initialTab?: FollowListTab;
}

export function FollowListView({ profileId, initialTab = "following" }: FollowListViewProps) {
  const [tab, setTab] = useState<string>(initialTab);
  const following = useFollowList(profileId);
  const followers = useFollowerList(profileId);

  const active = tab === "following" ? following : followers;

  return (
    <>
      <Tabs items={TABS} value={tab} onValueChange={setTab} />
      {active.loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {!active.loading && active.profiles.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">
          {tab === "following" ? "フォロー中のアカウントはまだいません。" : "フォロワーはまだいません。"}
        </p>
      )}
      {active.profiles.map((p) => (
        <ProfileRow key={p.profileId} profile={p} />
      ))}
      {active.hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => active.loadMore()} disabled={active.loading}>
            もっと見る
          </Button>
        </div>
      )}
    </>
  );
}
