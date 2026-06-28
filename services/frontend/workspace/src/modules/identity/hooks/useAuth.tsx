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
  selectRole,
  selectIsHydrated,
  selectUserId,
} from "@/stores/authStore";
import type { Role } from "@/lib/auth";

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
  resetPassword: (
    phoneNumber: string,
    newPassword: string,
    verificationToken: string
  ) => Promise<boolean>;
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

  // Identity-only zustand state. The access/refresh tokens live in httpOnly
  // cookies set by the BFF; React never holds them.
  const userId = useAuthStore(selectUserId);
  const role = useAuthStore(selectRole);
  const isHydrated = useAuthStore(selectIsHydrated);
  const setIdentity = useAuthStore((state) => state.setIdentity);
  const clearIdentity = useAuthStore((state) => state.clearIdentity);

  // SWR fetcher for /api/identity/me. The cookie rides along automatically
  // (same-origin). The BFF refreshes transparently on UNAUTHENTICATED, so the
  // client does not have to orchestrate refresh-retry itself.
  const meFetcher = useCallback(async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) return res.json();
    if (res.status === 401) {
      // Cookie missing or refresh failed — drop identity so the shell redirects.
      clearIdentity();
    }
    // FALLBACK: Returns null when authentication fails
    return null;
  }, [clearIdentity]);

  const {
    data: userData,
    isLoading: swrLoading,
    mutate,
  } = useSWR(isHydrated && userId ? "/api/identity/me" : null, meFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 5000,
  });

  const isLoading = !isHydrated || swrLoading;

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
    if (!res.ok) throw new Error("SMSの送信に失敗しました");
    return true;
  };

  const verifySMS = async (phoneNumber: string, code: string) => {
    const res = await fetch("/api/identity/verify-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "認証コードの検証に失敗しました");
    return data.verificationToken;
  };

  // The BFF sets access/refresh cookies on a 2xx response from register / login.
  // We seed identity from response.account so the shell can render synchronously.
  void role; // kept as a reactive subscription so role changes re-render.
  void userId;

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
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");

    if (!data.account?.id) {
      throw new Error("登録に失敗しました");
    }

    setIdentity({
      userId: data.account.id,
      role: toStoreRole(data.account.role),
    });

    setNewUserFlag(true);
    mutate(
      {
        id: data.account.id,
        phoneNumber: data.account.phoneNumber,
        role: data.account.role,
      },
      { revalidate: false }
    );

    router.push("/onboarding");
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
    if (!res.ok) throw new Error(data.error || "ログインに失敗しました");

    if (!data.account?.id) {
      throw new Error("ログインに失敗しました");
    }

    setIdentity({
      userId: data.account.id,
      role: toStoreRole(data.account.role),
    });

    if (data.reactivated === true) {
      // Lightweight UX hint; alert is enough for MVP, replace with a proper
      // toast component if the codebase has one and it's already wired.
      if (typeof window !== "undefined") {
        window.alert("お帰りなさい。アカウントは復活しました。");
      }
    }

    setNewUserFlag(false);
    mutate(
      {
        id: data.account.id,
        phoneNumber: data.account.phoneNumber,
        role: data.account.role,
      },
      { revalidate: false }
    );

    router.push("/");
  };

  const resetPassword = async (
    phoneNumber: string,
    newPassword: string,
    verificationToken: string
  ) => {
    const res = await fetch("/api/identity/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, newPassword, verificationToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "パスワードの再設定に失敗しました");
    return true;
  };

  const logout = async () => {
    // The BFF reads refresh from cookie and clears both cookies on success.
    // Always call it (even with no userId) so a stale cookie is cleared.
    try {
      await fetch("/api/identity/logout", { method: "POST" });
    } catch {
      // SILENT: logout failures still must clear local identity below.
    }

    clearIdentity();

    setNewUserFlag(false);
    mutate(null, { revalidate: false });

    router.push("/login");
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
        resetPassword,
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
