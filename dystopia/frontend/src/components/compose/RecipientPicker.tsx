"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { useFollowList, useFollowerList } from "@/modules/social/hooks";
import type { SocialProfileView } from "@/modules/social/types";
import { useSearchUsers, type SearchUsersRoleFilter } from "@/modules/discovery/hooks/useSearchUsers";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import type { RecipientSource } from "./resolveRecipientSource";

const ROLE_FILTER: Record<string, SearchUsersRoleFilter> = { guest: 1, cast: 2 };
const ROLE_LABEL = { cast: "キャスト", guest: "ゲスト" } as const;

interface RecipientPickerProps {
  source: RecipientSource;
  onPick: (profile: SocialProfileView) => void;
}

function matches(profile: SocialProfileView, query: string): boolean {
  const q = query.toLowerCase();
  return profile.displayName.toLowerCase().includes(q) || profile.username.toLowerCase().includes(q);
}

export function RecipientPicker({ source, onPick }: RecipientPickerProps) {
  const [query, setQuery] = useState("");
  const viewerId = useAuthStore(selectActiveProfileId);
  const following = useFollowList();
  const followers = useFollowerList();
  const trimmed = query.trim();
  const searchesEveryone = source.search === "everyone" && trimmed.length > 0;
  const search = useSearchUsers(searchesEveryone ? trimmed : "", source.role ? ROLE_FILTER[source.role] : 0);

  const initial = source.initial === "following" ? following : followers;
  const listed = searchesEveryone
    ? search
    : { ...initial, profiles: initial.profiles.filter((p) => trimmed.length === 0 || matches(p, trimmed)) };
  const profiles = listed.profiles.filter((p) => p.profileId !== viewerId && (!source.role || p.role === source.role));
  const stillLoading = listed.loading && profiles.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="名前やユーザー名で探す"
        aria-label="宛先を探す"
      />
      <p className="text-xs text-text-muted">{searchesEveryone ? "検索結果" : source.listLabel}</p>
      <ul className="max-h-[50vh] overflow-y-auto">
        {profiles.map((profile) => (
          <li key={profile.profileId}>
            <button
              type="button"
              onClick={() => onPick(profile)}
              className="flex w-full items-center gap-3 border-b border-divider px-1 py-2.5 text-left hover:bg-bg-secondary"
            >
              <Avatar src={profile.avatarUrl || undefined} fallback={profile.displayName.slice(0, 1) || "?"} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-text-primary">{profile.displayName}</span>
                <span className="block truncate text-xs text-text-secondary">@{profile.username}</span>
              </span>
              {profile.role && (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-text-secondary">
                  {ROLE_LABEL[profile.role]}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {stillLoading && <p className="px-1 py-2 text-sm text-text-secondary">読み込み中…</p>}
      {!stillLoading && profiles.length === 0 && (
        <p className="px-1 py-2 text-sm text-text-secondary">
          {trimmed.length > 0 ? "該当する相手がいません" : source.emptyHint}
        </p>
      )}
    </div>
  );
}
