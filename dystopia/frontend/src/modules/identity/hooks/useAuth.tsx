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
import { useToastStore } from "@/stores/toastStore";
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
  register: (phoneNumber: string, password: string) => Promise<void>;
  verify: (
    phoneNumber: string,
    code: string,
    password: string,
    role: 1 | 2,
  ) => Promise<void>;
  signIn: (
    phoneNumber: string,
    password: string,
    role: 1 | 2,
  ) => Promise<{ reactivated: boolean }>;
  login: (phoneNumber: string, password: string, role?: 1 | 2) => Promise<void>;
  signOut: () => Promise<void>;
  logout: () => Promise<void>;
  forgotPassword: (phoneNumber: string) => Promise<void>;
  confirmForgotPassword: (
    phoneNumber: string,
    code: string,
    newPassword: string,
  ) => Promise<void>;
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
  const meFetcher = useCallback(
    async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) return res.json();
      if (res.status === 401) {
        // Cookie missing or refresh failed — drop identity so the shell redirects.
        clearIdentity();
      }
      // FALLBACK: Returns null when authentication fails
      return null;
    },
    [clearIdentity],
  );

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

  // The BFF sets access/refresh cookies on verify / sign-in.
  // We seed identity from response.account so the shell can render synchronously.
  void role; // kept as a reactive subscription so role changes re-render.
  void userId;

  const register = async (phoneNumber: string, password: string) => {
    const res = await fetch("/api/identity/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登録に失敗しました");
  };

  const verify = async (
    phoneNumber: string,
    code: string,
    password: string,
    verifyRole: 1 | 2,
  ) => {
    const res = await fetch("/api/identity/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code, password, role: verifyRole }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "認証コードの検証に失敗しました");

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
        phoneNumber,
        role: data.account.role,
      },
      { revalidate: false },
    );
  };

  const signIn = async (
    phoneNumber: string,
    password: string,
    signInRole: 1 | 2,
  ) => {
    const res = await fetch("/api/identity/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password, role: signInRole }),
    });
    const data = await res.json();
    // 423 Locked carries a friendly message in `data.message` (with retry minutes);
    // fall back to `data.error` for other failure codes.
    if (!res.ok)
      throw new Error(data.message || data.error || "ログインに失敗しました");

    if (!data.account?.id) {
      throw new Error("ログインに失敗しました");
    }

    setIdentity({
      userId: data.account.id,
      role: toStoreRole(data.account.role),
    });

    if (data.reactivated === true) {
      // Non-blocking toast; mobile browsers can silently suppress repeat
      // window.alert dialogs, which would drop this feedback entirely.
      useToastStore.getState().show("お帰りなさい。アカウントは復活しました。");
    }

    setNewUserFlag(false);
    mutate(
      {
        id: data.account.id,
        phoneNumber,
        role: data.account.role,
      },
      { revalidate: false },
    );

    router.push("/");
    return { reactivated: data.reactivated === true };
  };

  const login = async (
    phoneNumber: string,
    password: string,
    loginRole: 1 | 2 = 1,
  ) => {
    await signIn(phoneNumber, password, loginRole);
  };

  const forgotPassword = async (phoneNumber: string) => {
    const res = await fetch("/api/identity/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "認証コードの送信に失敗しました");
  };

  const confirmForgotPassword = async (
    phoneNumber: string,
    code: string,
    newPassword: string,
  ) => {
    const res = await fetch("/api/identity/confirm-forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, code, newPassword }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.error || "パスワードの再設定に失敗しました");
  };

  const signOut = async () => {
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

  const logout = signOut;

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        register,
        verify,
        signIn,
        login,
        signOut,
        logout,
        forgotPassword,
        confirmForgotPassword,
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
