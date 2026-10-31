"use client";

import { useSWRConfig } from "swr";
import { revalidatePostLists } from "@/modules/post/lib/revalidate";
import { ScheduleBulkSheet } from "@/modules/schedule/components/ScheduleBulkSheet";
import { useAuthStore, selectActiveProfileId } from "@/stores/authStore";
import { usePostFeedStore } from "@/stores/postFeedStore";

export function ScheduleComposeSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const profileId = useAuthStore(selectActiveProfileId);
  const { mutate } = useSWRConfig();
  const notifyPostCreated = usePostFeedStore((s) => s.notifyPostCreated);

  if (!profileId) return null;

  const onSaved = () => {
    mutate((key) => typeof key === "string" && (key.startsWith("/api/posts") || key.startsWith("/api/feed")), undefined, { revalidate: true });
    void revalidatePostLists();
    notifyPostCreated();
  };

  return <ScheduleBulkSheet profileId={profileId} open={open} onClose={onClose} onSaved={onSaved} />;
}
