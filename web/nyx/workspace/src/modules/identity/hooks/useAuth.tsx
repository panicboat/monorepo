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



  // Helper to determine keys based on context or role
  const getKeys = (role?: number | string) => {
    // If role is explicitly provided, use it
    if (role === 2 || role === "ROLE_CAST") {
      return { access: "nyx_cast_access_token", refresh: "nyx_cast_refresh_token" };
    }
    if (role === 1 || role === "ROLE_GUEST") {
      return { access: "nyx_guest_access_token", refresh: "nyx_guest_refresh_token" };
    }

    // Otherwise, infer from URL context
    if (pathname?.startsWith("/cast")) {
      return { access: "nyx_cast_access_token", refresh: "nyx_cast_refresh_token" };
    }
    // Default to Guest
    return { access: "nyx_guest_access_token", refresh: "nyx_guest_refresh_token" };
  };

  const refreshToken = useCallback(async (contextKeys?: { access: string; refresh: string }): Promise<boolean> => {
    const keys = contextKeys || getKeys();
    const rToken = localStorage.getItem(keys.refresh);
    if (!rToken) return false;
    try {
      const res = await fetch("/api/identity/refresh-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: rToken }),
      });
      if (res.ok) {
        const data = await res.json();
        // Handle snake_case vs camelCase mismatch
        const accessToken = data.accessToken || data.access_token;
        const newRefreshToken = data.refreshToken || data.refresh_token;

        if (accessToken) localStorage.setItem(keys.access, accessToken);
        if (newRefreshToken) localStorage.setItem(keys.refresh, newRefreshToken);
        return true;
      }
    } catch (e) {
      console.error("Refresh failed", e);
    }
    return false;
  }, [pathname]);

  // SWR fetcher for /api/identity/me with token refresh support
  const authFetcher = useCallback(async (url: string) => {
    const keys = getKeys();
    const token = localStorage.getItem(keys.access);
    if (!token) return null;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      return res.json();
    }

    // Handle 401 with token refresh
    if (res.status === 401) {
      const refreshed = await refreshToken(keys);
      if (refreshed) {
        const newToken = localStorage.getItem(keys.access);
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
      localStorage.removeItem(keys.access);
      localStorage.removeItem(keys.refresh);
    }

    return null;
  }, [pathname, refreshToken]);

  // Check if we have a token for conditional fetching
  const keys = getKeys();
  const hasToken = typeof window !== "undefined" && localStorage.getItem(keys.access);

  // Use SWR for user data fetching
  const { data: userData, isLoading, mutate } = useSWR(
    hasToken ? "/api/identity/me" : null,
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

    const registerKeys = getKeys(data.userProfile.role);
    // Handle snake_case vs camelCase mismatch
    const accessToken = data.accessToken || data.access_token;
    const newRefreshToken = data.refreshToken || data.refresh_token;

    if (accessToken) {
        localStorage.setItem(registerKeys.access, accessToken);
    } else {
        console.error("Register Error: No access token found in response", data);
    }

    if (newRefreshToken) {
      localStorage.setItem(registerKeys.refresh, newRefreshToken);
    }
    const userRole = data.userProfile.role;
    const isGuest = userRole === 1 || userRole === "ROLE_GUEST";

    // Set new user flag and update SWR cache
    setNewUserFlag(true);
    mutate({
      id: data.userProfile.id,
      phoneNumber: data.userProfile.phoneNumber,
      role: userRole,
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

    const loginKeys = getKeys(data.userProfile.role);
    // Handle snake_case vs camelCase mismatch
    const accessToken = data.accessToken || data.access_token;
    const newRefreshToken = data.refreshToken || data.refresh_token;

    if (accessToken) {
      localStorage.setItem(loginKeys.access, accessToken);
    } else {
      console.error("Login Error: No access token found in response", data);
    }

    if (newRefreshToken) {
      localStorage.setItem(loginKeys.refresh, newRefreshToken);
    }
    const userRole = data.userProfile.role;
    const isGuest = userRole === 1 || userRole === "ROLE_GUEST";

    // Update SWR cache with user data
    setNewUserFlag(false);
    mutate({
      id: data.userProfile.id,
      phoneNumber: data.userProfile.phoneNumber,
      role: userRole,
    }, { revalidate: false });

    if (isGuest) {
      router.push("/");
    } else {
      router.push("/cast/home");
    }
  };

  const logout = async () => {
    const logoutKeys = getKeys(); // Use current context keys for logout
    const rToken = localStorage.getItem(logoutKeys.refresh);
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
    localStorage.removeItem(logoutKeys.access);
    localStorage.removeItem(logoutKeys.refresh);

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
