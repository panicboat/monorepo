"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import useSWR from "swr";
import {
  inferRoleFromPath,
  inferRoleFromApiRole,
  getAccessToken,
  clearTokens,
  hasTokens,
  type UserRole,
} from "@/lib/auth";
import {
  useAuthStore,
  authApi,
  isGuestRole,
  getAuthRedirectPath,
} from "@/stores";

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
  const router = useRouter();
  const pathname = usePathname();

  // Zustand store
  const {
    user: storeUser,
    setUser,
    setLoading,
    setCurrentRole,
    clearAuth,
  } = useAuthStore();

  // Helper to determine role based on context or API role
  const getCurrentRole = useCallback((apiRole?: number | string): UserRole => {
    if (apiRole !== undefined) {
      return inferRoleFromApiRole(apiRole);
    }
    return inferRoleFromPath(pathname);
  }, [pathname]);

  // Update current role when pathname changes
  useEffect(() => {
    setCurrentRole(inferRoleFromPath(pathname));
  }, [pathname, setCurrentRole]);

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
      const refreshed = await authApi.refreshToken(role);
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
  }, [getCurrentRole]);

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

  // Sync SWR data with Zustand store
  useEffect(() => {
    if (userData) {
      setUser({
        id: userData.id,
        phoneNumber: userData.phoneNumber,
        role: userData.role,
        isNew: storeUser?.isNew,
      });
    } else if (!isLoading && !userData) {
      setLoading(false);
    }
  }, [userData, isLoading, setUser, setLoading, storeUser?.isNew]);

  // Derive user from SWR data (for backward compatibility)
  const user: User | null = userData ? {
    id: userData.id,
    name: userData.phoneNumber,
    isGuest: isGuestRole(userData.role),
    role: userData.role,
    isNew: storeUser?.isNew,
  } : null;

  const requestSMS = useCallback(async (phoneNumber: string) => {
    return authApi.requestSMS(phoneNumber);
  }, []);

  const verifySMS = useCallback(async (phoneNumber: string, code: string) => {
    return authApi.verifySMS(phoneNumber, code);
  }, []);

  const register = useCallback(async (
    phoneNumber: string,
    password: string,
    verificationToken: string,
    role: number = 1,
  ) => {
    const result = await authApi.register(phoneNumber, password, verificationToken, role);

    if (!result.tokens.accessToken) {
      console.error("Register Error: No access token found in response");
    }

    const userRole = inferRoleFromApiRole(result.user.role);

    // Update Zustand store
    setUser({
      ...result.user,
      isNew: true,
    });

    // Update SWR cache
    mutate({
      id: result.user.id,
      phoneNumber: result.user.phoneNumber,
      role: result.user.role,
    }, { revalidate: false });

    // Navigate
    router.push(getAuthRedirectPath(userRole, true));
  }, [router, mutate, setUser]);

  const login = useCallback(async (phoneNumber: string, password: string, role?: number) => {
    const result = await authApi.login(phoneNumber, password, role);

    if (!result.tokens.accessToken) {
      console.error("Login Error: No access token found in response");
    }

    const userRole = inferRoleFromApiRole(result.user.role);

    // Update Zustand store
    setUser({
      ...result.user,
      isNew: false,
    });

    // Update SWR cache
    mutate({
      id: result.user.id,
      phoneNumber: result.user.phoneNumber,
      role: result.user.role,
    }, { revalidate: false });

    // Navigate
    router.push(getAuthRedirectPath(userRole, false));
  }, [router, mutate, setUser]);

  const logout = useCallback(async () => {
    const role = getCurrentRole();
    await authApi.logout(role);

    // Clear Zustand store
    clearAuth();

    // Clear SWR cache
    mutate(null, { revalidate: false });

    // Navigate
    if (pathname?.startsWith("/cast")) {
      router.push("/cast/login");
    } else {
      router.push("/login");
    }
  }, [getCurrentRole, pathname, router, mutate, clearAuth]);

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
