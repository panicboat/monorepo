import type { ProfileSummary } from "@/stub/profile/v1/service_pb";
import type { FollowRequestItem } from "../types";

export function profileToFollowRequestItem(p: ProfileSummary): FollowRequestItem {
  return {
    requesterProfileId: p.profileId,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
  };
}
