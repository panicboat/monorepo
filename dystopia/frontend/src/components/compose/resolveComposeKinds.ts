import type { Role } from "@/lib/auth";

export type ComposeKind = "post" | "message" | "karte" | "review";

interface ComposeContext {
  role: Role | null;
  karteAccess: boolean;
}

export function resolveComposeKinds({ role, karteAccess }: ComposeContext): ComposeKind[] {
  if (role === "guest") return ["post", "message", "review"];
  if (role === "cast") return karteAccess ? ["post", "message", "karte"] : ["post", "message"];
  return ["post"];
}
