"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";

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
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const refreshToken = async (contextKeys?: { access: string; refresh: string }): Promise<boolean> => {
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
        const refreshToken = data.refreshToken || data.refresh_token;

        if (accessToken) localStorage.setItem(keys.access, accessToken);
        if (refreshToken) localStorage.setItem(keys.refresh, refreshToken);
        return true;
      }
    } catch (e) {
      console.error("Refresh failed", e);
    }
    return false;
  };

  const fetchUser = async (token: string, keys: { access: string; refresh: string }, retry = true) => {
    try {
      const res = await fetch("/api/identity/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const role = data.role;
        setUser({
          id: data.id,
          name: data.phoneNumber,
          isGuest: role === 1 || role === "ROLE_GUEST",
          role: role,
        });
      } else {
        if (res.status === 401 && retry) {
          const refreshed = await refreshToken(keys);
          if (refreshed) {
             const newToken = localStorage.getItem(keys.access);
             if (newToken) {
               return fetchUser(newToken, keys, false);
             }
          }
        }
        // Token invalid
        localStorage.removeItem(keys.access);
        localStorage.removeItem(keys.refresh);
        setUser(null);
      }
    } catch (e) {
      console.error(e);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const keys = getKeys();
    const token = localStorage.getItem(keys.access);
    if (token) {
      fetchUser(token, keys);
    } else {
      setIsLoading(false);
    }
  }, [pathname]); // Re-run when switching contexts

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

    const keys = getKeys(data.userProfile.role);
    // Handle snake_case vs camelCase mismatch
    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;

    if (accessToken) {
        localStorage.setItem(keys.access, accessToken);
    } else {
        console.error("Register Error: No access token found in response", data);
    }

    if (refreshToken) {
      localStorage.setItem(keys.refresh, refreshToken);
    }
    const userRole = data.userProfile.role;
    const isGuest = userRole === 1 || userRole === "ROLE_GUEST";

    setUser({
      id: data.userProfile.id,
      name: data.userProfile.phoneNumber,
      isGuest,
      role: userRole,
      isNew: true,
    });

    if (isGuest) {
      router.push("/");
    } else {
      router.push("/cast/onboarding");
    }
  };

  const login = async (phoneNumber: string, password: string, role?: number) => {
    try {
      const res = await fetch("/api/identity/sign-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      const keys = getKeys(data.userProfile.role);
      // Handle snake_case vs camelCase mismatch
      const accessToken = data.accessToken || data.access_token;
      const refreshToken = data.refreshToken || data.refresh_token;

      if (accessToken) {
        localStorage.setItem(keys.access, accessToken);
      } else {
        console.error("Login Error: No access token found in response", data);
      }

      if (refreshToken) {
        localStorage.setItem(keys.refresh, refreshToken);
      }
      const userRole = data.userProfile.role;
      const isGuest = userRole === 1 || userRole === "ROLE_GUEST";
      setUser({
        id: data.userProfile.id,
        name: data.userProfile.phoneNumber,
        isGuest,
        role: userRole,
      });

      if (isGuest) {
        router.push("/");
      } else {
        router.push("/cast/home");
      }
    } catch (e) {
      throw e;
    }
  };

  const logout = async () => {
    const keys = getKeys(); // Use current context keys for logout
    const rToken = localStorage.getItem(keys.refresh);
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
    localStorage.removeItem(keys.access);
    localStorage.removeItem(keys.refresh);
    setUser(null);

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
