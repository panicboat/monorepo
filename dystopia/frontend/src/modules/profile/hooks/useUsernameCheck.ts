"use client";

import { useEffect, useState } from "react";
import { authFetch } from "@/lib/auth/fetch";
import type { UsernameAvailability } from "@/modules/profile/types";

const CHECK_DELAY_MS = 400;

export async function checkUsernameAvailability(
  username: string
): Promise<UsernameAvailability> {
  return authFetch<UsernameAvailability>(
    `/api/profile/username-check?username=${encodeURIComponent(username)}`,
    { method: "GET" }
  );
}

export function useUsernameAvailability(username: string, savedUsername: string) {
  const [fetched, setFetched] = useState<{ username: string; result: UsernameAvailability } | null>(null);
  const dirty = !!username && username !== savedUsername;

  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(async () => {
      try {
        setFetched({ username, result: await checkUsernameAvailability(username) });
      } catch {
        // FALLBACK: Show no availability when the check cannot complete; the save still validates on the server.
        setFetched(null);
      }
    }, CHECK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [username, dirty]);

  // Derive the status from the checked name so a stale answer never applies to newer input.
  const status = dirty && fetched?.username === username ? fetched.result : null;
  return { status, blocked: status !== null && !status.available };
}
