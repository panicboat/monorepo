"use client";

import { useState } from "react";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectRole, selectIsHydrated } from "@/stores/authStore";
import { Tabs } from "@/components/ui/tab";
import { AreaSettings } from "@/modules/profile/components/AreaSettings";
import { PrivacySettings } from "@/modules/profile/components/PrivacySettings";
import { AccountSettings } from "@/modules/profile/components/AccountSettings";
import { NotificationSettings } from "@/modules/notifications/components/NotificationSettings";
import { AppearanceSettings } from "@/modules/profile/components/AppearanceSettings";
import { useDeactivateAccount } from "@/modules/identity/hooks/useDeactivateAccount";

export default function SettingsPage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { profile, loading, error, saveProfile } = useProfile();
  const { deactivate, loading: deactivating, error: deactivateError } = useDeactivateAccount();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const items = [
    { id: "notifications", label: "通知設定" },
    ...(role === "cast" ? [{ id: "area", label: "エリア" }] : []),
    { id: "privacy", label: "プライバシー" },
    { id: "appearance", label: "外観" },
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
        {tab === "appearance" && <AppearanceSettings />}
        {tab === "account" && (
          <>
            <AccountSettings profile={profile} save={saveProfile} />
            <section className="border-t border-border mt-8 pt-6">
              <h2 className="text-base font-medium text-red-600">アカウントを退会</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                30 日以内に同じ電話番号で login すれば自動的に復活します。
                30 日経過後はデータが消えます。
                <span className="block mt-1">
                  ※ カルテに残した記録は、他の Cast の安全情報として残ります。
                </span>
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
            <p className="text-sm">本当に退会しますか？</p>
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
                  await deactivate();
                  setConfirmOpen(false);
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
