import type { Profile } from "@/stub/profile/v1/service_pb";
import type {
  SocialAccountView,
  FollowRequestItem,
} from "../types";

export function profileToSocialAccount(p: Profile): SocialAccountView {
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
