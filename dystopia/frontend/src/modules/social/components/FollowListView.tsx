"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfileName } from "@/components/ui/profile-name";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { useFollowList, useFollowerList } from "@/modules/social/hooks";
import { BlockedAccountsList } from "./BlockedAccountsList";
import { FollowButton } from "./FollowButton";
import type { ProfileSummaryView } from "@/modules/profile/types";

export type FollowListTab = "following" | "followers";

const TABS: TabItem[] = [
  { id: "following", label: "フォロー中" },
  { id: "followers", label: "フォロワー" },
];
const BLOCKED_TAB: TabItem = { id: "blocked", label: "ブロック" };

function ProfileRow({ profile }: { profile: ProfileSummaryView }) {
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
        <p className="flex">
          <ProfileName profile={profile} />
        </p>
        <p className="truncate text-sm text-text-secondary">@{profile.username}</p>
      </Link>
      <FollowButton targetProfileId={profile.profileId} />
    </div>
  );
}

interface FollowListViewProps {
  profileId?: string;
  initialTab?: FollowListTab;
  showBlocked?: boolean;
}

export function FollowListView({ profileId, initialTab = "following", showBlocked = false }: FollowListViewProps) {
  const [tab, setTab] = useState<string>(initialTab);
  const following = useFollowList(profileId);
  const followers = useFollowerList(profileId);

  const active = tab === "following" ? following : followers;

  const tabs = showBlocked ? [...TABS, BLOCKED_TAB] : TABS;

  if (tab === BLOCKED_TAB.id) {
    return (
      <>
        <Tabs items={tabs} value={tab} onValueChange={setTab} />
        <BlockedAccountsList />
      </>
    );
  }

  return (
    <>
      <Tabs items={tabs} value={tab} onValueChange={setTab} />
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
