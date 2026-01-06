"use client";

import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";

export type User = {
  id: string;
  name: string;
  avatarUrl?: string; // Icon
  isGuest: boolean;
};

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  loginWithGoogle: () => Promise<void>;
  requestSMS: (phoneNumber: string) => Promise<void>;
  verifySMS: (code: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Simulate initial check
  const router = useRouter();

  useEffect(() => {
    // Simulate session check on mount
    const timer = setTimeout(() => {
      // For development convenience, we can uncomment this to auto-login
      // setUser({ id: "guest-1", name: "Guest User", isGuest: true });
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const loginWithGoogle = async () => {
    setIsLoading(true);
    // Mock OIDC delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setUser({
      id: "google-user-1",
      name: "Taro Yamada",
      avatarUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Taro",
      isGuest: true,
    });
    setIsLoading(false);
    router.push("/"); // Redirect to root (Home)
  };

  const requestSMS = async (phoneNumber: string) => {
    // Mock SMS request
    console.log(`Requesting SMS for ${phoneNumber}`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  };

  const verifySMS = async (code: string) => {
    // Mock Verification
    if (code === "1234") { // Hardcoded mock code
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setUser({
        id: "sms-user-1",
        name: "090-XXXX-XXXX",
        isGuest: true,
      });
      setIsLoading(false);
      router.push("/");
    } else {
      throw new Error("Invalid code");
    }
  };

  const logout = async () => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setUser(null);
    setIsLoading(false);
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithGoogle, requestSMS, verifySMS, logout }}>
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
