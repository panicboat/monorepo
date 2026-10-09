import { useAuthStore } from "@/stores/authStore";

export const PROFILE_ID_HEADER = "x-profile-id";

export function profileRequestHeaders(): Record<string, string> {
  const profileId = useAuthStore.getState().activeProfileId;
  return profileId ? { [PROFILE_ID_HEADER]: profileId } : {};
}
