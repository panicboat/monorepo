"use client";

import { useState } from "react";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectIsHydrated, selectRole } from "@/stores/authStore";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tab";
import { PrivacySettings } from "@/modules/profile/components/PrivacySettings";
import { AccountSettings } from "@/modules/profile/components/AccountSettings";
import { ProfileManager } from "@/modules/profile/components/ProfileManager";
import { NotificationSettings } from "@/modules/notifications/components/NotificationSettings";
import { AppearanceSettings } from "@/modules/profile/components/AppearanceSettings";
import { useDeactivateAccount } from "@/modules/identity/hooks/useDeactivateAccount";
import { getFeatureDescription } from "@/modules/onboarding/components/FeatureTourModal";

export function SettingsHeader() {
  return <PageHeader title="設定" description={getFeatureDescription("settings")} />;
}

export default function SettingsPage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { profile, loading, error, saveProfile } = useProfile();
  const { deactivate, loading: deactivating, error: deactivateError } = useDeactivateAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const items = [
    { id: "notifications", label: "通知設定" },
    { id: "privacy", label: "プライバシー" },
    { id: "appearance", label: "外観" },
    ...(role === "cast" ? [{ id: "profiles", label: "プロフィール" }] : []),
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
      <div className="px-4 pt-4">
        <SettingsHeader />
      </div>
      <Tabs
        items={items}
        value={tab}
        onValueChange={setTab}
        className="overflow-x-auto [&>button]:shrink-0 [&>button]:whitespace-nowrap"
      />
      <div className="px-4">
        {tab === "notifications" && <NotificationSettings />}
        {tab === "privacy" && <PrivacySettings profile={profile} save={saveProfile} />}
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "profiles" && role === "cast" && <ProfileManager />}
        {tab === "account" && (
          <>
            <AccountSettings profile={profile} save={saveProfile} />
            <section className="border-t border-border mt-8 pt-6">
              <h2 className="text-base font-medium text-red-600">アカウントを退会</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                30 日以内に同じ電話番号で login すれば自動的に復活します。
                30 日経過後はデータが消えます。
              </p>
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={deactivating}
                className="mt-3 rounded border border-red-600 bg-bg px-3 py-1 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                退会する
              </button>
              {deactivateError && (
                <p className="mt-2 text-sm text-red-600">{deactivateError.message}</p>
              )}
            </section>
          </>
        )}
      </div>
      {confirmOpen && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        >
          <div className="w-full max-w-sm rounded bg-bg p-4 shadow-lg">
            <p className="text-sm font-medium">本当に退会しますか？</p>
            <p className="mt-2 text-sm text-muted-foreground">
              30 日以内に同じ電話番号で login すれば自動的に復活します。
              30 日経過後はデータが消えます。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded px-3 py-1 text-sm hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={deactivating}
                onClick={async () => {
                  const ok = await deactivate();
                  if (ok) setConfirmOpen(false);
                }}
                className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50"
              >
                退会する
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
