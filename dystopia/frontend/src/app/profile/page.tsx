"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectIsHydrated } from "@/stores/authStore";

// Superseded by /u/[username] (which now carries the edit affordance too); kept so old links/bookmarks still land somewhere.
export default function ProfilePage() {
  const router = useRouter();
  const isHydrated = useAuthStore(selectIsHydrated);
  const { profile, loading, error } = useProfile();

  useEffect(() => {
    if (profile?.username) {
      router.replace(`/u/${profile.username}`);
    }
  }, [profile?.username, router]);

  if (!isHydrated || loading || profile?.username) {
    return <main className="mx-auto max-w-xl p-6 text-text-secondary">読み込み中…</main>;
  }
  if (error || !profile) {
    return (
      <main className="mx-auto max-w-xl p-6 text-text-secondary">
        プロフィールを表示できませんでした。ログインが必要です。
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-xl p-6 text-text-secondary">
      プロフィールを表示するにはユーザー名の設定が必要です。
    </main>
  );
}
