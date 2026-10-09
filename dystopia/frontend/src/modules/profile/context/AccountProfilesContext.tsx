"use client";

import { createContext, useContext } from "react";
import type { ProfileView } from "@/modules/profile/types";

export interface AccountProfiles {
  profiles: ProfileView[];
  switchProfile: (profileId: string) => void;
  refresh: () => Promise<void>;
}

const AccountProfilesContext = createContext<AccountProfiles>({
  profiles: [],
  switchProfile: () => {},
  refresh: async () => {},
});

export const AccountProfilesProvider = AccountProfilesContext.Provider;

export function useAccountProfiles(): AccountProfiles {
  return useContext(AccountProfilesContext);
}
