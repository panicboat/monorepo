"use client";

import { authFetch } from "@/lib/auth/fetch";

export async function markFootprintsRead(): Promise<void> {
  try {
    await authFetch("/api/footprints/mark-read", { method: "POST" });
  } catch {
    // SILENT: mark-read failure is non-critical
  }
}
