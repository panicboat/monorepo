"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import { useAuthStore, selectAccountId, selectActiveProfileId } from "@/stores/authStore";
import { myProfilesKey, resolveProfileSession, type ProfileSession } from "@/modules/profile/lib/session";
import type { MyProfilesResponse } from "@/modules/profile/types";

export function useProfileSession(): ProfileSession | null {
  const accountId = useAuthStore(selectAccountId);
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);

  const { data } = useSWR<MyProfilesResponse>(
    accountId ? myProfilesKey(accountId) : null,
    ([url]: readonly [string, string]) => fetcher<MyProfilesResponse>(url),
    { revalidateOnFocus: false }
  );

  const session = data ? resolveProfileSession(data.profiles, activeProfileId) : null;
  const resolvedProfileId = session?.kind === "active" ? session.profileId : null;
  const isResolved = session !== null;

  useEffect(() => {
    if (isResolved && resolvedProfileId !== activeProfileId) {
      setActiveProfile(resolvedProfileId);
    }
  }, [isResolved, resolvedProfileId, activeProfileId, setActiveProfile]);

  return session;
}
