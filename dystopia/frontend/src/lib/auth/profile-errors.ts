import { mutate } from "swr";
import { useAuthStore } from "@/stores/authStore";
import { isMyProfilesKey } from "@/modules/profile/lib/session";

export const PROFILE_REQUIRED = "profile_required";
export const PROFILE_NOT_PERMITTED = "profile_not_permitted";

const PROFILE_SELECTION_REASONS: readonly string[] = [PROFILE_REQUIRED, PROFILE_NOT_PERMITTED];

// Match on the reason code, not the HTTP status: 403 and 422 are also returned for messaging, karte and limit errors.
export function isProfileSelectionError(body: unknown): boolean {
  if (typeof body !== "object" || body === null) return false;
  const code = (body as { code?: unknown }).code;
  return typeof code === "string" && PROFILE_SELECTION_REASONS.includes(code);
}

export function resetProfileSelection(sentProfileId: string | null): void {
  if (!useAuthStore.getState().denyActiveProfile(sentProfileId)) return;
  void mutate(isMyProfilesKey, undefined, { revalidate: true });
  void mutate("/api/identity/me");
}
