"use client";

import { Avatar } from "@/components/ui/avatar";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";

export function ProfileSwitcher() {
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const { profiles, switchProfile } = useAccountProfiles();
  const others = profiles.filter((profile) => !profile.disabled && profile.id !== activeProfileId);

  if (others.length === 0) return null;

  return (
    <section aria-label="プロフィールを切り替え" className="border-t border-border px-2 py-2">
      <p className="px-2 pb-1 text-xs text-text-secondary">プロフィールを切り替え</p>
      <ul>
        {others.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              onClick={() => switchProfile(profile.id)}
              className="flex w-full items-center gap-3 rounded-full px-2 py-2 text-left hover:bg-bg-secondary"
            >
              <Avatar src={profile.avatarUrl || undefined} fallback={(profile.displayName || "?").slice(0, 1)} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-text-primary">{profile.displayName || "—"}</span>
                <span className="block truncate text-xs text-text-secondary">@{profile.username || "—"}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
