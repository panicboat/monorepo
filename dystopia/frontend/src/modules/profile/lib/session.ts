import type { ScopedMutator } from "swr";
import type { MyProfilesResponse, ProfileView } from "@/modules/profile/types";

export const MY_PROFILES_URL = "/api/profile/mine";

export type ProfileSession =
  | { kind: "onboarding" }
  | { kind: "active"; profileId: string }
  | { kind: "select" }
  | { kind: "unavailable" };

// Never pick one of several enabled profiles implicitly; acting as an unintended profile is the failure to avoid.
export function resolveProfileSession(
  profiles: Pick<ProfileView, "id" | "disabled">[],
  storedProfileId: string | null,
  deniedProfileId: string | null = null
): ProfileSession {
  const enabled = profiles.filter((profile) => !profile.disabled);
  if (enabled.length === 0) return { kind: "onboarding" };
  if (enabled.length === 1) {
    if (enabled[0].id === deniedProfileId) return { kind: "unavailable" };
    return { kind: "active", profileId: enabled[0].id };
  }
  if (
    storedProfileId &&
    storedProfileId !== deniedProfileId &&
    enabled.some((profile) => profile.id === storedProfileId)
  ) {
    return { kind: "active", profileId: storedProfileId };
  }
  return { kind: "select" };
}

export function selectableProfiles<T extends Pick<ProfileView, "id" | "disabled">>(
  profiles: T[],
  deniedProfileId: string | null
): T[] {
  return profiles.filter((profile) => !profile.disabled && profile.id !== deniedProfileId);
}

export function myProfilesKey(accountId: string): readonly [string, string] {
  return [MY_PROFILES_URL, accountId];
}

export function isMyProfilesKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === MY_PROFILES_URL;
}

// Target one account's key: a filter would also rewrite the cached list of another account signed in earlier in this tab.
export async function addToMyProfiles(
  mutateCache: ScopedMutator,
  accountId: string,
  profile: ProfileView
): Promise<void> {
  const key = myProfilesKey(accountId);
  const updated = await mutateCache<MyProfilesResponse>(
    key,
    (current) => (current ? { profiles: [...current.profiles, profile] } : current),
    { revalidate: false }
  );
  if (!updated) await mutateCache(key);
}
