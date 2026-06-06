"use client";

import { useState } from "react";
import { useProfile } from "@/modules/profile/hooks";
import { useAuthStore, selectRole, selectIsHydrated } from "@/stores/authStore";
import { ProfileHeader } from "@/modules/profile/components/ProfileHeader";
import { EditProfileModal } from "@/modules/profile/components/EditProfileModal";

export default function ProfilePage() {
  const isHydrated = useAuthStore(selectIsHydrated);
  const role = useAuthStore(selectRole);
  const { profile, loading, error, saveProfile, saveMedia } = useProfile();
  const [editing, setEditing] = useState(false);

  if (!isHydrated || loading) {
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
    <main className="mx-auto max-w-xl bg-bg pb-10 text-text-primary">
      <ProfileHeader profile={profile} role={role} onEdit={() => setEditing(true)} />
      <EditProfileModal
        open={editing}
        onOpenChange={setEditing}
        profile={profile}
        isCast={role === "cast"}
        onSave={async (payload) => {
          await saveProfile(payload);
        }}
        onSaveMedia={async (payload) => {
          await saveMedia(payload);
        }}
      />
    </main>
  );
}
