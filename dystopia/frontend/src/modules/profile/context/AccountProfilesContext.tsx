"use client";

import { createContext, useContext } from "react";
import type { ProfileView } from "@/modules/profile/types";

export interface AccountProfiles {
  profiles: ProfileView[];
  switchProfile: (profileId: string) => void;
  refresh: () => Promise<void>;
  append: (profile: ProfileView) => Promise<void>;
}

// FALLBACK: Outside the shell there is no account list to offer, so consumers get an empty one that changes nothing.
const AccountProfilesContext = createContext<AccountProfiles>({
  profiles: [],
  switchProfile: () => {},
  refresh: async () => {},
  append: async () => {},
});

export const AccountProfilesProvider = AccountProfilesContext.Provider;

export function useAccountProfiles(): AccountProfiles {
  return useContext(AccountProfilesContext);
}
