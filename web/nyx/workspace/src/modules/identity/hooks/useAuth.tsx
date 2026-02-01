"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import {
  useAuthStore,
  selectAccessToken,
  selectRole,
  selectIsHydrated,
} from "@/stores/authStore";
import type { Role, TokenData } from "@/lib/auth";

export type User = {
  id: string;
  name: string; // Phone Number for now
  avatarUrl?: string;
  isGuest: boolean;
  role: number | string;
  isNew?: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  requestSMS: (phoneNumber: string) => Promise<boolean>;
  verifySMS: (phoneNumber: string, code: string) => Promise<string>;
  register: (
    phoneNumber: string,
    password: string,
    verificationToken: string,
    role?: number
  ) => Promise<void>;
  login: (
    phoneNumber: string,
    password: string,
    role?: number
  ) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Convert API role to store role
 */
function toStoreRole(apiRole: number | string): Role {
  if (apiRole === 2 || apiRole === "ROLE_CAST") {
    return "cast";
  }
  return "guest";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [newUserFlag, setNewUserFlag] = useState(false);
  const router = useRouter();

  // Zustand store
  const accessToken = useAuthStore(selectAccessToken);
  const role = useAuthStore(selectRole);
  const isHydrated = useAuthStore(selectIsHydrated);
  const setTokens = useAuthStore((state) => state.setTokens);
  const clearTokens = useAuthStore((state) => state.clearTokens);
  const refreshTokenFromStore = useAuthStore((state) => state.refreshToken);

  // Token refresh function
  const refreshToken = useCallback(async (): Promise<boolean> => {
    const rToken = refreshTokenFromStore;
    if (!rToken) return false;

    try {
      const res = await fetch("/api/identity/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rToken }),
      });
      if (res.ok) {
        const data = await res.json();
        const newAccessToken = data.accessToken || data.access_token;
        const newRefreshToken = data.refreshToken || data.refresh_token;

        if (newAccessToken && newRefreshToken && role) {
          setTokens({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            role,
            userId: useAuthStore.getState().userId || "",
          });
          return true;
        }
      }
    } catch (e) {
      console.error("Refresh failed", e);
    }
    return false;
  }, [refreshTokenFromStore, role, setTokens]);

  // SWR fetcher for /api/identity/me with token refresh support
  const authFetcher = useCallback(
    async (url: string) => {
      const token = useAuthStore.getState().accessToken;
      if (!token) return null;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        return res.json();
      }

      // Handle 401 with token refresh
      if (res.status === 401) {
        const refreshed = await refreshToken();
        if (refreshed) {
          const newToken = useAuthStore.getState().accessToken;
          if (newToken) {
            const retryRes = await fetch(url, {
              headers: { Authorization: `Bearer ${newToken}` },
            });
            if (retryRes.ok) {
              return retryRes.json();
            }
          }
        }
        // Token refresh failed - clear tokens
        clearTokens();
      }

      return null;
    },
    [refreshToken, clearTokens]
  );

  // Use SWR for user data fetching (only when hydrated and has token)
  const {
    data: userData,
    isLoading: swrLoading,
    mutate,
  } = useSWR(isHydrated && accessToken ? "/api/identity/me" : null, authFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  // Loading state includes hydration
  const isLoading = !isHydrated || swrLoading;

  // Derive user from SWR data
  const user: User | null = userData
    ? {
        id: userData.id,
        name: userData.phoneNumber,
        isGuest: userData.role === 1 || userData.role === "ROLE_GUEST",
        role: userData.role,
        isNew: newUserFlag,
      }
    : null;

  const requestSMS = async (phoneNumber: string) => {
    const res = await fetch("/api/identity/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    if (!res.ok) throw new Error("Failed to send SMS");
    return true;
  };

  const verifySMS = async (phoneNumber: string, code: string) => {
    const res = await fetch("/api/identity/verify-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Verification failed");
    return data.verificationToken;
  };

  const register = async (
    phoneNumber: string,
    password: string,
    verificationToken: string,
    registerRole: number = 1
  ) => {
    const res = await fetch("/api/identity/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber,
        password,
        verificationToken,
        role: registerRole,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    const newAccessToken = data.accessToken || data.access_token;
    const newRefreshToken = data.refreshToken || data.refresh_token;
    const userRole = data.userProfile.role;
    const isGuest = userRole === 1 || userRole === "ROLE_GUEST";

    if (!newAccessToken) {
      console.error("Register Error: No access token found in response", data);
      throw new Error("Registration failed: No access token");
    }

    // Save tokens to authStore
    const tokenData: TokenData = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken || "",
      role: toStoreRole(userRole),
      userId: data.userProfile.id,
    };
    setTokens(tokenData);

    // Set new user flag and update SWR cache
    setNewUserFlag(true);
    mutate(
      {
        id: data.userProfile.id,
        phoneNumber: data.userProfile.phoneNumber,
        role: userRole,
      },
      { revalidate: false }
    );

    if (isGuest) {
      router.push("/onboarding");
    } else {
      router.push("/cast/onboarding");
    }
  };

  const login = async (
    phoneNumber: string,
    password: string,
    loginRole?: number
  ) => {
    const res = await fetch("/api/identity/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password, role: loginRole }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    const newAccessToken = data.accessToken || data.access_token;
    const newRefreshToken = data.refreshToken || data.refresh_token;
    const userRole = data.userProfile.role;
    const isGuest = userRole === 1 || userRole === "ROLE_GUEST";

    if (!newAccessToken) {
      console.error("Login Error: No access token found in response", data);
      throw new Error("Login failed: No access token");
    }

    // Save tokens to authStore
    const tokenData: TokenData = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken || "",
      role: toStoreRole(userRole),
      userId: data.userProfile.id,
    };
    setTokens(tokenData);

    // Update SWR cache with user data
    setNewUserFlag(false);
    mutate(
      {
        id: data.userProfile.id,
        phoneNumber: data.userProfile.phoneNumber,
        role: userRole,
      },
      { revalidate: false }
    );

    if (isGuest) {
      router.push("/");
    } else {
      router.push("/cast/home");
    }
  };

  const logout = async () => {
    const rToken = refreshTokenFromStore;
    if (rToken) {
      try {
        await fetch("/api/identity/logout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: rToken }),
        });
      } catch {
        // Ignore logout errors
      }
    }

    // Clear tokens from authStore
    clearTokens();

    // Clear SWR cache
    setNewUserFlag(false);
    mutate(null, { revalidate: false });

    // Navigate based on current role (from store, not pathname)
    if (role === "cast") {
      router.push("/cast/login");
    } else {
      router.push("/login");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        requestSMS,
        verifySMS,
        register,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
