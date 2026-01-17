"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { LoginGate } from "@/modules/identity/components/LoginGate";

export default function CastPortalPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.isNew && user.role === 2) {
        router.push("/cast/onboarding");
      } else {
        router.push("/cast/home");
      }
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <LoginGate variant="cast" />;
  }

  return null;
}
