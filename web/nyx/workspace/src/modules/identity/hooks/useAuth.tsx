"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import {
  getTokenKeys,
  inferRoleFromPath,
  inferRoleFromApiRole,
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
  normalizeTokenResponse,
  hasTokens,
  type UserRole,
} from "@/lib/auth";

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
    role?: number,
  ) => Promise<void>;
  login: (phoneNumber: string, password: string, role?: number) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [newUserFlag, setNewUserFlag] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Helper to determine role based on context or API role
  const getCurrentRole = (apiRole?: number | string): UserRole => {
    if (apiRole !== undefined) {
      return inferRoleFromApiRole(apiRole);
    }
    return inferRoleFromPath(pathname);
  };

  const refreshTokenFn = useCallback(async (role: UserRole): Promise<boolean> => {
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
  }, []);

  // SWR fetcher for /api/identity/me with token refresh support
  const authFetcher = useCallback(async (url: string) => {
    const role = getCurrentRole();
    const token = getAccessToken(role);
    if (!token) return null;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      return res.json();
    }

    // Handle 401 with token refresh
    if (res.status === 401) {
      const refreshed = await refreshTokenFn(role);
      if (refreshed) {
        const newToken = getAccessToken(role);
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
      clearTokens(role);
    }

    return null;
  }, [pathname, refreshTokenFn]);

  // Check if we have a token for conditional fetching
  const currentRole = getCurrentRole();
  const hasValidToken = typeof window !== "undefined" && hasTokens(currentRole);

  // Use SWR for user data fetching
  const { data: userData, isLoading, mutate } = useSWR(
    hasValidToken ? "/api/identity/me" : null,
    authFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );

  // Derive user from SWR data
  const user: User | null = userData ? {
    id: userData.id,
    name: userData.phoneNumber,
    isGuest: userData.role === 1 || userData.role === "ROLE_GUEST",
    role: userData.role,
    isNew: newUserFlag,
  } : null;

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
    role: number = 1,
  ) => {
    const res = await fetch("/api/identity/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password, verificationToken, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    const userRole = getCurrentRole(data.userProfile.role);
    const tokens = normalizeTokenResponse(data);

    if (tokens.accessToken) {
      setTokens(userRole, tokens);
    } else {
      console.error("Register Error: No access token found in response", data);
    }

    const isGuest = userRole === "guest";

    // Set new user flag and update SWR cache
    setNewUserFlag(true);
    mutate({
      id: data.userProfile.id,
      phoneNumber: data.userProfile.phoneNumber,
      role: data.userProfile.role,
    }, { revalidate: false });

    if (isGuest) {
      router.push("/");
    } else {
      router.push("/cast/onboarding");
    }
  };

  const login = async (phoneNumber: string, password: string, role?: number) => {
    const res = await fetch("/api/identity/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password, role }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    const userRole = getCurrentRole(data.userProfile.role);
    const tokens = normalizeTokenResponse(data);

    if (tokens.accessToken) {
      setTokens(userRole, tokens);
    } else {
      console.error("Login Error: No access token found in response", data);
    }

    const isGuest = userRole === "guest";

    // Update SWR cache with user data
    setNewUserFlag(false);
    mutate({
      id: data.userProfile.id,
      phoneNumber: data.userProfile.phoneNumber,
      role: data.userProfile.role,
    }, { revalidate: false });

    if (isGuest) {
      router.push("/");
    } else {
      router.push("/cast/home");
    }
  };

  const logout = async () => {
    const role = getCurrentRole();
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

    // Clear SWR cache
    setNewUserFlag(false);
    mutate(null, { revalidate: false });

    if (pathname?.startsWith("/cast")) {
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
