/**
 * Auth Store
 *
 * Zustand store for authentication state management.
 * Uses persist middleware for localStorage persistence.
 *
 * Usage:
 *   const { accessToken, role, setTokens, clearTokens } = useAuthStore();
 *
 * Note: For migration from legacy tokens, call migrateTokens() on app initialization.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { type Role, type TokenData, migrateTokens } from "@/lib/auth";

interface AuthState {
  // State
  accessToken: string | null;
  refreshToken: string | null;
  role: Role | null;
  userId: string | null;
  isHydrated: boolean;

  // Actions
  setTokens: (tokens: TokenData) => void;
  clearTokens: () => void;
  setHydrated: () => void;

  // Computed (implemented as getters via selectors)
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      accessToken: null,
      refreshToken: null,
      role: null,
      userId: null,
      isHydrated: false,

      // Actions
      setTokens: (tokens: TokenData) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          role: tokens.role,
          userId: tokens.userId,
        }),

      clearTokens: () =>
        set({
          accessToken: null,
          refreshToken: null,
          role: null,
          userId: null,
        }),

      setHydrated: () => set({ isHydrated: true }),

      // Computed
      isAuthenticated: () => !!get().accessToken,
    }),
    {
      name: "nyx-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        role: state.role,
        userId: state.userId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

/**
 * Initialize auth store with migration from legacy tokens
 * Call this once on app initialization
 */
export function initializeAuthStore(): void {
  const migratedData = migrateTokens();
  if (migratedData) {
    useAuthStore.getState().setTokens(migratedData);
  }
}

/**
 * Selectors for common use cases
 */
export const selectAccessToken = (state: AuthState) => state.accessToken;
export const selectRole = (state: AuthState) => state.role;
export const selectUserId = (state: AuthState) => state.userId;
export const selectIsAuthenticated = (state: AuthState) => !!state.accessToken;
export const selectIsHydrated = (state: AuthState) => state.isHydrated;
