"use client";

import { useCallback, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/swr";
import {
  useAuthStore,
  selectAccountId,
  selectActiveProfileId,
  selectDeniedProfileId,
} from "@/stores/authStore";
import { myProfilesKey, resolveProfileSession, type ProfileSession } from "@/modules/profile/lib/session";
import type { MyProfilesResponse } from "@/modules/profile/types";

export interface ProfileSessionState {
  session: ProfileSession | null;
  hasListError: boolean;
  retry: () => void;
}

export function useProfileSession(): ProfileSessionState {
  const accountId = useAuthStore(selectAccountId);
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const deniedProfileId = useAuthStore(selectDeniedProfileId);
  const setActiveProfile = useAuthStore((s) => s.setActiveProfile);
  const clearDeniedProfile = useAuthStore((s) => s.clearDeniedProfile);

  const { data, error, mutate } = useSWR<MyProfilesResponse>(
    accountId ? myProfilesKey(accountId) : null,
    ([url]: readonly [string, string]) => fetcher<MyProfilesResponse>(url),
    { revalidateOnFocus: false }
  );

  const session = data ? resolveProfileSession(data.profiles, activeProfileId, deniedProfileId) : null;
  const resolvedProfileId = session?.kind === "active" ? session.profileId : null;
  const isResolved = session !== null;

  const retry = useCallback(() => {
    clearDeniedProfile();
    void mutate();
  }, [clearDeniedProfile, mutate]);

  useEffect(() => {
    if (isResolved && resolvedProfileId !== activeProfileId) {
      setActiveProfile(resolvedProfileId);
    }
  }, [isResolved, resolvedProfileId, activeProfileId, setActiveProfile]);

  return { session, hasListError: !data && !!error, retry };
}
