"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, type TabItem } from "@/components/ui/tab";
import { useFollowList, useFollowerList, FollowButton } from "@/modules/social";
import type { SocialAccountView } from "@/modules/social/types";

const TABS: TabItem[] = [
  { id: "following", label: "フォロー中" },
  { id: "followers", label: "フォロワー" },
];

function ProfileRow({ profile }: { profile: SocialAccountView }) {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3">
      <Avatar src={profile.avatarUrl || undefined} fallback={profile.displayName.slice(0, 1) || "?"} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-text-primary">{profile.displayName}</p>
        <p className="truncate text-sm text-text-secondary">@{profile.username}</p>
      </div>
      <FollowButton targetAccountId={profile.accountId} />
    </div>
  );
}

export default function OshiPage() {
  const [tab, setTab] = useState("following");
  const following = useFollowList();
  const followers = useFollowerList();

  const active = tab === "following" ? following : followers;

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <h1 className="px-4 pb-2 pt-4 text-xl font-bold">推し</h1>
      <Tabs items={TABS} value={tab} onValueChange={setTab} />
      {active.loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {!active.loading && active.profiles.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">
          {tab === "following" ? "フォロー中のアカウントはまだいません。" : "フォロワーはまだいません。"}
        </p>
      )}
      {active.profiles.map((p) => (
        <ProfileRow key={p.accountId} profile={p} />
      ))}
      {active.hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={() => active.loadMore()} disabled={active.loading}>
            もっと見る
          </Button>
        </div>
      )}
    </main>
  );
}
