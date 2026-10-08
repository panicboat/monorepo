import { useAuthStore } from "@/stores/authStore";
import type { Role } from "@/lib/auth";

export function toStoreRole(apiRole: number | string): Role {
  return apiRole === 2 || apiRole === "ROLE_CAST" ? "cast" : "guest";
}

// The cookie is the authority: another tab can change the signed-in account without this tab's store noticing.
export function syncIdentityWithAccount(account: { id?: string; role?: number | string } | null | undefined): void {
  if (!account?.id || account.role === undefined) return;
  const state = useAuthStore.getState();
  if (state.accountId === account.id) return;
  state.setIdentity({ accountId: account.id, role: toStoreRole(account.role) });
}
