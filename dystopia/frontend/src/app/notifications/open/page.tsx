"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";
import { selectableProfiles } from "@/modules/profile/lib/session";
import { resolveNotificationOpen } from "@/modules/notifications/lib/open";
import { useAuthStore, selectActiveProfileId, selectDeniedProfileId } from "@/stores/authStore";

export default function NotificationOpenPage() {
  return (
    <Suspense>
      <NotificationOpen />
    </Suspense>
  );
}

// Renders nothing so the target page is first drawn as the receiving profile, never leaving footprints or reads as another.
function NotificationOpen() {
  const params = useSearchParams();
  const router = useRouter();
  const { profiles } = useAccountProfiles();
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const deniedProfileId = useAuthStore(selectDeniedProfileId);
  const setActiveProfile = useAuthStore((state) => state.setActiveProfile);
  const profileId = params?.get("profile") ?? null;
  const to = params?.get("to") ?? null;

  useEffect(() => {
    const { switchTo, destination } = resolveNotificationOpen({
      profileId,
      to,
      selectableProfileIds: selectableProfiles(profiles, deniedProfileId).map((profile) => profile.id),
      activeProfileId,
    });
    if (switchTo) {
      setActiveProfile(switchTo);
      return;
    }
    router.replace(destination);
  }, [profileId, to, profiles, deniedProfileId, activeProfileId, setActiveProfile, router]);

  return null;
}
