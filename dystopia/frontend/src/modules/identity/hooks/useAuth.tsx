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
  selectAccountId,
} from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { syncIdentityWithAccount, toStoreRole } from "@/lib/auth/identity-sync";

export type User = {
  id: string;
  name: string;
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
  ) => Promise<{ reactivated: boolean }>;
  login: (phoneNumber: string, password: string) => Promise<void>;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [newUserFlag, setNewUserFlag] = useState(false);
  const router = useRouter();

  const accountId = useAuthStore(selectAccountId);
  const role = useAuthStore(selectRole);
  const isHydrated = useAuthStore(selectIsHydrated);
  const setIdentity = useAuthStore((state) => state.setIdentity);
  const clearIdentity = useAuthStore((state) => state.clearIdentity);

  const meFetcher = useCallback(
    async (url: string) => {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const body = await res.json();
        syncIdentityWithAccount(body?.account);
        return body;
      }
      if (res.status === 401) {
        clearIdentity();
      }
      // FALLBACK: Return null when authentication fails.
      return null;
    },
    [clearIdentity],
  );

  const {
    data: userData,
    isLoading: swrLoading,
    mutate,
  } = useSWR(isHydrated && accountId ? "/api/identity/me" : null, meFetcher, {
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

  // Keep role in the dependency list because auth state must react to role changes.
  void role;
  void accountId;

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
      accountId: data.account.id,
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

  const signIn = async (phoneNumber: string, password: string) => {
    const res = await fetch("/api/identity/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password }),
    });
    const data = await res.json();
    if (!res.ok)
      throw new Error(data.message || data.error || "ログインに失敗しました");

    if (!data.account?.id) {
      throw new Error("ログインに失敗しました");
    }

    setIdentity({
      accountId: data.account.id,
      role: toStoreRole(data.account.role),
    });

    if (data.reactivated === true) {
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

  const login = async (phoneNumber: string, password: string) => {
    await signIn(phoneNumber, password);
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
