import type { Role } from "@/lib/auth";

export type ComposeKind = "post" | "schedule" | "message" | "karte" | "review";

interface ComposeContext {
  role: Role | null;
}

export function resolveComposeKinds({ role }: ComposeContext): ComposeKind[] {
  if (role === "guest") return ["post", "message", "review"];
  if (role === "cast") return ["post", "schedule", "message", "karte"];
  return ["post"];
}
