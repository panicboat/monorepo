"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  normalizeTokenResponse,
  inferRoleFromPath,
  inferRoleFromApiRole,
  hasTokens,
  type UserRole,
} from "@/lib/auth";

export interface AuthUser {
  id: string;
  phoneNumber: string;
  role: number | string;
  isNew?: boolean;
}

interface AuthState {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  currentRole: UserRole;

  // Actions
  setUser: (user: AuthUser | null) => void;
  setLoading: (loading: boolean) => void;
  setCurrentRole: (role: UserRole) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      currentRole: "guest",

      // Actions
      setUser: (user) =>
        set({
          user,
          isAuthenticated: user !== null,
          isLoading: false,
        }),

      setLoading: (isLoading) => set({ isLoading }),

      setCurrentRole: (currentRole) => set({ currentRole }),

      clearAuth: () =>
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        }),
    }),
    {
      name: "nyx-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist these fields (not tokens for security)
        isAuthenticated: state.isAuthenticated,
        currentRole: state.currentRole,
        // Don't persist user data - fetch fresh on load
      }),
    }
  )
);

/**
 * Auth API functions (separated from store for better testability)
 */
export const authApi = {
  async requestSMS(phoneNumber: string): Promise<boolean> {
    const res = await fetch("/api/identity/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    if (!res.ok) throw new Error("Failed to send SMS");
    return true;
  },

  async verifySMS(phoneNumber: string, code: string): Promise<string> {
    const res = await fetch("/api/identity/verify-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Verification failed");
    return data.verificationToken;
  },

  async register(
    phoneNumber: string,
    password: string,
    verificationToken: string,
    role: number = 1
  ): Promise<{ user: AuthUser; tokens: { accessToken?: string; refreshToken?: string } }> {
    const res = await fetch("/api/identity/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password, verificationToken, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    const tokens = normalizeTokenResponse(data);
    const userRole = inferRoleFromApiRole(data.userProfile.role);

    if (tokens.accessToken) {
      setTokens(userRole, tokens);
    }

    return {
      user: {
        id: data.userProfile.id,
        phoneNumber: data.userProfile.phoneNumber,
        role: data.userProfile.role,
        isNew: true,
      },
      tokens,
    };
  },

  async login(
    phoneNumber: string,
    password: string,
    role?: number
  ): Promise<{ user: AuthUser; tokens: { accessToken?: string; refreshToken?: string } }> {
    const res = await fetch("/api/identity/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    const tokens = normalizeTokenResponse(data);
    const userRole = inferRoleFromApiRole(data.userProfile.role);

    if (tokens.accessToken) {
      setTokens(userRole, tokens);
    }

    return {
      user: {
        id: data.userProfile.id,
        phoneNumber: data.userProfile.phoneNumber,
        role: data.userProfile.role,
        isNew: false,
      },
      tokens,
    };
  },

  async logout(role: UserRole): Promise<void> {
    const rToken = getRefreshToken(role);
    if (rToken) {
      try {
        await fetch("/api/identity/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rToken }),
        });
      } catch (e) {
        // Ignore logout errors
      }
    }
    clearTokens(role);
  },

  async refreshToken(role: UserRole): Promise<boolean> {
    const rToken = getRefreshToken(role);
    if (!rToken) return false;

    try {
      const res = await fetch("/api/identity/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rToken }),
      });
      if (res.ok) {
        const data = await res.json();
        const tokens = normalizeTokenResponse(data);
        setTokens(role, tokens);
        return true;
      }
    } catch (e) {
      console.error("Refresh failed", e);
    }
    return false;
  },

  async fetchUser(role: UserRole): Promise<AuthUser | null> {
    const token = getAccessToken(role);
    if (!token) return null;

    const res = await fetch("/api/identity/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      return {
        id: data.id,
        phoneNumber: data.phoneNumber,
        role: data.role,
      };
    }

    // Handle 401 with token refresh
    if (res.status === 401) {
      const refreshed = await authApi.refreshToken(role);
      if (refreshed) {
        const newToken = getAccessToken(role);
        if (newToken) {
          const retryRes = await fetch("/api/identity/me", {
            headers: { Authorization: `Bearer ${newToken}` },
          });
          if (retryRes.ok) {
            const data = await retryRes.json();
            return {
              id: data.id,
              phoneNumber: data.phoneNumber,
              role: data.role,
            };
          }
        }
      }
      // Token refresh failed - clear tokens
      clearTokens(role);
    }

    return null;
  },
};

/**
 * Helper to check if user is a guest based on role
 */
export function isGuestRole(role: number | string): boolean {
  return role === 1 || role === "ROLE_GUEST";
}

/**
 * Helper to get redirect path after auth
 */
export function getAuthRedirectPath(role: UserRole, isNew: boolean): string {
  if (role === "guest") {
    return "/";
  }
  return isNew ? "/cast/onboarding" : "/cast/home";
}
