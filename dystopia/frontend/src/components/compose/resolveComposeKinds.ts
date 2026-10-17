import type { Role } from "@/lib/auth";

export type ComposeKind = "post" | "message" | "karte" | "review";

interface ComposeContext {
  role: Role | null;
}

export function resolveComposeKinds({ role }: ComposeContext): ComposeKind[] {
  if (role === "guest") return ["post", "message", "review"];
  if (role === "cast") return ["post", "message", "karte"];
  return ["post"];
}
