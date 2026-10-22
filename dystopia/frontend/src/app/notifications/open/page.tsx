"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccountProfiles } from "@/modules/profile/context/AccountProfilesContext";
import { selectableProfiles } from "@/modules/profile/lib/session";
import { resolveNotificationOpen } from "@/modules/notifications/lib/open";
import { takeNotificationHandoff, type NotificationHandoff } from "@/modules/notifications/lib/handoff";
import { useAuthStore, selectActiveProfileId, selectDeniedProfileId } from "@/stores/authStore";

const NOTIFICATION_LIST = "/notifications";

// Kept outside the component: switching remounts this page under the new profile, and by then the record is gone from the cache.
let recordAcrossSwitch: { id: string; record: NotificationHandoff } | null = null;

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
  const { profiles, loaded } = useAccountProfiles();
  const activeProfileId = useAuthStore(selectActiveProfileId);
  const deniedProfileId = useAuthStore(selectDeniedProfileId);
  const setActiveProfile = useAuthStore((state) => state.setActiveProfile);
  const id = params?.get("id") ?? null;
  const recordRead = useRef(false);
  const [record, setRecord] = useState<NotificationHandoff | null | undefined>(undefined);

  useEffect(() => {
    // An empty list while loading would pass for an account with nothing to switch to and open the page as the previous profile.
    if (!loaded || recordRead.current) return;
    recordRead.current = true;
    if (id && recordAcrossSwitch?.id === id) {
      setRecord(recordAcrossSwitch.record);
      recordAcrossSwitch = null;
      return;
    }
    void takeNotificationHandoff(id).then(setRecord);
  }, [loaded, id]);

  useEffect(() => {
    if (record === undefined) return;
    if (record === null) {
      router.replace(NOTIFICATION_LIST);
      return;
    }
    const { switchTo, destination } = resolveNotificationOpen({
      profileId: record.profile,
      to: record.to,
      selectableProfileIds: selectableProfiles(profiles, deniedProfileId).map((profile) => profile.id),
      activeProfileId,
    });
    if (switchTo) {
      if (id) recordAcrossSwitch = { id, record };
      setActiveProfile(switchTo);
      return;
    }
    router.replace(destination);
  }, [record, id, profiles, deniedProfileId, activeProfileId, setActiveProfile, router]);

  return null;
}
