"use client";

import { BlockedAccountsList } from "@/modules/social/components/BlockedAccountsList";

export default function BlockedAccountsPage() {
  return (
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <div className="px-4 pt-4">
        <h1 className="text-xl font-bold">ブロック一覧</h1>
      </div>
      <BlockedAccountsList />
    </main>
  );
}
