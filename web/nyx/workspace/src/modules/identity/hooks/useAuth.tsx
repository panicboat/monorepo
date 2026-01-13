"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useRouter } from "next/navigation";

export type User = {
  id: string;
  name: string; // Phone Number for now
  avatarUrl?: string;
  isGuest: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  requestSMS: (phoneNumber: string) => Promise<boolean>;
  verifySMS: (phoneNumber: string, code: string) => Promise<string>;
  register: (phoneNumber: string, password: string, verificationToken: string) => Promise<void>;
  login: (phoneNumber: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchUser = async (token: string) => {
    try {
      const res = await fetch("/api/identity/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // TODO: Use generated Proto Enum types instead of manual mapping
        const role = data.role; // 1 = Guest, 2 = Cast
        setUser({
          id: data.id,
          name: data.phoneNumber,
          isGuest: role === 1 || role === "ROLE_GUEST",
        });
      } else {
         // Token invalid
         localStorage.removeItem("access_token");
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
    const token = localStorage.getItem("access_token");
    if (token) {
      fetchUser(token);
    } else {
      setIsLoading(false);
    }
  }, []);

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

  const register = async (phoneNumber: string, password: string, verificationToken: string) => {
    const res = await fetch("/api/identity/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password, verificationToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");

    localStorage.setItem("access_token", data.accessToken);
    const role = data.userProfile.role;
    setUser({
      id: data.userProfile.id,
      name: data.userProfile.phoneNumber,
      isGuest: role === 1 || role === "ROLE_GUEST",
    });
    router.push("/");
  };

  const login = async (phoneNumber: string, password: string) => {
    const res = await fetch("/api/identity/sign-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");

    localStorage.setItem("access_token", data.accessToken);
    const role = data.userProfile.role;
    setUser({
      id: data.userProfile.id,
      name: data.userProfile.phoneNumber,
      isGuest: role === 1 || role === "ROLE_GUEST",
    });
    router.push("/");
  };

  const logout = async () => {
    localStorage.removeItem("access_token");
    setUser(null);
    router.push("/");
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
