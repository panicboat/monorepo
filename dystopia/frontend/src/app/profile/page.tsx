"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditProfileSheet } from "@/modules/profile/components/EditProfileSheet";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectIsHydrated } from "@/stores/authStore";

export default function ProfilePage() {
  const router = useRouter();
  const isHydrated = useAuthStore(selectIsHydrated);
  const { profile, loading, error, saveProfile, saveMedia } = useProfile();
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [editing, setEditing] = useState<{ session: number; open: boolean } | null>(null);

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
      <p>プロフィールを表示するにはユーザー名の設定が必要です。</p>
      <Button
        variant="primary"
        size="sm"
        className="mt-4"
        onClick={() => setEditing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
      >
        ユーザー名を設定
      </Button>
      {editing && (
        <EditProfileSheet
          key={editing.session}
          open={editing.open}
          onOpenChange={(open) => setEditing((current) => current && { ...current, open })}
          profile={profile}
          isCast={profile.role === 2}
          onSave={async (payload) => {
            await saveProfile(payload);
          }}
          onSaveMedia={async (payload) => {
            await saveMedia(payload);
          }}
        />
      )}
    </main>
  );
}
