"use client";

import { useState } from "react";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectRole, selectIsHydrated } from "@/stores/authStore";
import { Tabs } from "@/components/ui/tab";
import { AreaSettings } from "@/modules/profile/components/AreaSettings";
import { PrivacySettings } from "@/modules/profile/components/PrivacySettings";
import { AccountSettings } from "@/modules/profile/components/AccountSettings";
import { NotificationSettings } from "@/modules/notifications/components/NotificationSettings";

export default function SettingsPage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { profile, loading, error, saveProfile } = useProfile();

  const items = [
    { id: "notifications", label: "通知設定" },
    ...(role === "cast" ? [{ id: "area", label: "エリア" }] : []),
    { id: "privacy", label: "プライバシー" },
    { id: "account", label: "アカウント" },
  ];
  const [tab, setTab] = useState("notifications");

  if (!isHydrated || loading) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return (
      <main className="mx-auto max-w-xl p-6 text-text-secondary">
        設定を表示できませんでした。ログインが必要です。
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <h1 className="px-4 py-4 text-lg font-bold">設定</h1>
      <Tabs items={items} value={tab} onValueChange={setTab} />
      <div className="px-4">
        {tab === "notifications" && <NotificationSettings />}
        {tab === "area" && role === "cast" && <AreaSettings profile={profile} save={saveProfile} />}
        {tab === "privacy" && <PrivacySettings profile={profile} save={saveProfile} />}
        {tab === "account" && <AccountSettings profile={profile} save={saveProfile} />}
      </div>
    </main>
  );
}
