"use client";

import { Avatar } from "@/components/ui/avatar";
import type { ProfileView } from "@/modules/profile/types";

export interface ProfilePickerProps {
  profiles: Pick<ProfileView, "id" | "displayName" | "username" | "avatarUrl">[];
  onSelect: (profileId: string) => void;
}

export function ProfilePicker({ profiles, onSelect }: ProfilePickerProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-bold text-text-primary">プロフィールを選択</h1>
        <p className="mb-8 text-center text-sm text-text-secondary">使用するプロフィールを選んでください。</p>
        <ul className="space-y-2">
          {profiles.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                onClick={() => onSelect(profile.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3 text-left hover:bg-bg-secondary"
              >
                <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-text-primary">{profile.displayName || "—"}</span>
                  <span className="block truncate text-xs text-text-secondary">@{profile.username || "—"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
