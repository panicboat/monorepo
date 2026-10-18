"use client";

import { NotificationSettings } from "@/modules/notifications/components/NotificationSettings";

export default function NotificationSettingsPage() {
  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">通知設定</h1>
      </div>
      <div className="px-4">
        <NotificationSettings />
      </div>
    </main>
  );
}
