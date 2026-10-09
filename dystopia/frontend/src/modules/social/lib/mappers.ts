import type { Profile } from "@/stub/profile/v1/service_pb";
import type {
  SocialProfileView,
  FollowRequestItem,
} from "../types";

export function profileToSocialProfile(p: Profile): SocialProfileView {
  return {
    profileId: p.id,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isPrivate: !!p.isPrivate,
  };
}

export function profileToFollowRequestItem(p: Profile): FollowRequestItem {
  return {
    requesterProfileId: p.id,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
  };
}
