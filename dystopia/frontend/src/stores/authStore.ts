import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Role } from "@/lib/auth";

interface PersistedAuth {
  role: Role | null;
  accountId: string | null;
  activeProfileId: string | null;
}

// Keep only identity state because tokens remain in httpOnly cookies.
interface AuthState extends PersistedAuth {
  isHydrated: boolean;
  deniedProfileId: string | null;

  setIdentity: (identity: { accountId: string; role: Role }) => void;
  setActiveProfile: (profileId: string | null) => void;
  denyActiveProfile: (sentProfileId: string | null) => boolean;
  clearDeniedProfile: () => void;
  clearIdentity: () => void;
  setHydrated: () => void;

  isAuthenticated: () => boolean;
}

export function migrateAuthState(persisted: unknown): PersistedAuth {
  const state = (persisted ?? {}) as Partial<PersistedAuth> & { userId?: string | null };
  return {
    role: state.role ?? null,
    accountId: state.accountId ?? state.userId ?? null,
    activeProfileId: state.activeProfileId ?? null,
  };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      role: null,
      accountId: null,
      activeProfileId: null,
      deniedProfileId: null,
      isHydrated: false,

      // Drop the acting profile on an account change so one login never acts as another login's profile.
      setIdentity: ({ accountId, role }) =>
        set((state) => ({
          accountId,
          role,
          activeProfileId: state.accountId === accountId ? state.activeProfileId : null,
          deniedProfileId: null,
        })),
      setActiveProfile: (profileId) => set({ activeProfileId: profileId }),
      denyActiveProfile: (sentProfileId) => {
        const state = get();
        if (state.activeProfileId !== sentProfileId) return false;
        set({
          activeProfileId: null,
          deniedProfileId: sentProfileId !== null ? sentProfileId : state.deniedProfileId,
        });
        return true;
      },
      clearDeniedProfile: () => set({ deniedProfileId: null }),
      clearIdentity: () => set({ accountId: null, role: null, activeProfileId: null, deniedProfileId: null }),
      setHydrated: () => set({ isHydrated: true }),

      isAuthenticated: () => !!get().accountId,
    }),
    {
      name: "frontend-auth",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedAuth => ({
        role: state.role,
        accountId: state.accountId,
        activeProfileId: state.activeProfileId,
      }),
      migrate: (persisted) => migrateAuthState(persisted),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

export const selectRole = (state: AuthState) => state.role;
export const selectAccountId = (state: AuthState) => state.accountId;
export const selectActiveProfileId = (state: AuthState) => state.activeProfileId;
export const selectDeniedProfileId = (state: AuthState) => state.deniedProfileId;
export const selectIsAuthenticated = (state: AuthState) => !!state.accountId;
export const selectIsHydrated = (state: AuthState) => state.isHydrated;
