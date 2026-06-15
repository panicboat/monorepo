"use client";

import { Avatar } from "@/components/ui/avatar";
import { BlockButton, useBlockedList } from "@/modules/social";

export default function BlockedAccountsPage() {
  const { profiles, loading, error } = useBlockedList();

  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">ブロック一覧</h1>
        <p className="pt-1 text-sm text-text-secondary">
          ブロック中のアカウント {profiles.length} 件
        </p>
      </div>

      {loading && <p className="px-4 py-6 text-text-secondary">読み込み中…</p>}
      {error && <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました。</p>}
      {!loading && profiles.length === 0 && (
        <p className="px-4 py-6 text-text-secondary">ブロック中のアカウントはありません。</p>
      )}

      {profiles.map((p) => (
        <div
          key={p.accountId}
          className="flex items-center gap-3 border-b border-border px-4 py-3"
        >
          <Avatar
            src={p.avatarUrl || undefined}
            fallback={p.displayName.slice(0, 1) || "?"}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-text-primary">{p.displayName}</p>
            <p className="truncate text-sm text-text-secondary">@{p.username}</p>
          </div>
          <BlockButton targetAccountId={p.accountId} />
        </div>
      ))}
    </main>
  );
}
