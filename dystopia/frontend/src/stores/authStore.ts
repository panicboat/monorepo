
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { Role } from "@/lib/auth";

// Keep only identity state because tokens remain in httpOnly cookies.
interface AuthState {
  role: Role | null;
  userId: string | null;
  isHydrated: boolean;

  setIdentity: (identity: { userId: string; role: Role }) => void;
  clearIdentity: () => void;
  setHydrated: () => void;

  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      role: null,
      userId: null,
      isHydrated: false,

      setIdentity: ({ userId, role }) => set({ userId, role }),
      clearIdentity: () => set({ userId: null, role: null }),
      setHydrated: () => set({ isHydrated: true }),

      isAuthenticated: () => !!get().userId,
    }),
    {
      name: "frontend-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        role: state.role,
        userId: state.userId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

export const selectRole = (state: AuthState) => state.role;
export const selectUserId = (state: AuthState) => state.userId;
export const selectIsAuthenticated = (state: AuthState) => !!state.userId;
export const selectIsHydrated = (state: AuthState) => state.isHydrated;
