"use client";

import { useAuth } from "@/modules/identity/hooks/useAuth";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, ReactNode } from "react";

const PUBLIC_PATHS = ["/cast/login", "/cast/onboarding"]; // onboarding root is public (Welcome page)
const PUBLIC_PATH_PREFIXES: string[] = []; // onboarding steps are protected (not in public list)

export const CastAuthGuard = ({ children }: { children: ReactNode }) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  useEffect(() => {
    if (isPublicPath || isLoading) return;

    if (!user) {
      router.push("/cast/login");
    } else if (user.role !== 2 && user.role !== "ROLE_CAST") {
      router.push("/cast/login");
    }
  }, [user, isLoading, router, isPublicPath]);

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (isLoading || !user || (user.role !== 2 && user.role !== "ROLE_CAST")) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-role-cast border-t-transparent" />
      </div>
    );
  }

  return <>{children}</>;
};
