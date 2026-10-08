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

export function myProfilesKey(accountId: string): readonly [string, string] {
  return [MY_PROFILES_URL, accountId];
}

export function isMyProfilesKey(key: unknown): boolean {
  return Array.isArray(key) && key[0] === MY_PROFILES_URL;
}

// Target one account's key: a filter would also rewrite the cached list of another account signed in earlier in this tab.
export function addToMyProfiles(mutateCache: ScopedMutator, accountId: string, profile: ProfileView) {
  return mutateCache<MyProfilesResponse>(
    myProfilesKey(accountId),
    (current) => ({ profiles: [...(current?.profiles ?? []), profile] }),
    { revalidate: false }
  );
}
