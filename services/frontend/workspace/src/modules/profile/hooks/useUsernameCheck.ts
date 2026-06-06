"use client";

import { authFetch } from "@/lib/auth/fetch";
import type { UsernameAvailability } from "@/modules/profile/types";

export async function checkUsernameAvailability(
  username: string
): Promise<UsernameAvailability> {
  return authFetch<UsernameAvailability>(
    `/api/profile/username-check?username=${encodeURIComponent(username)}`,
    { method: "GET" }
  );
}
