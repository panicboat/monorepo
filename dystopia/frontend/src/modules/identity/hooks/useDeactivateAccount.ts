"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth";
import { useAuthStore } from "@/stores/authStore";

export function useDeactivateAccount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const clearIdentity = useAuthStore((s) => s.clearIdentity);

  const deactivate = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await authFetch<{ ok: boolean }>("/api/identity/deactivate", {
        method: "POST",
        body: {},
      });
      // Clear local identity + cookies are server-controlled; the next
      // /api/identity/me will 401 and the shell redirect kicks in.
      clearIdentity();
      router.push("/");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to deactivate"));
      return false;
    } finally {
      setLoading(false);
    }
  }, [clearIdentity, router]);

  return { deactivate, loading, error };
}
