import type { Profile } from "@/stub/profile/v1/service_pb";
import type { Role } from "@/lib/auth";
import type {
  SocialProfileView,
  FollowRequestItem,
} from "../types";

const ROLE_BY_NUMBER: Record<number, Role> = { 1: "guest", 2: "cast" };

export function profileToSocialProfile(p: Profile): SocialProfileView {
  return {
    profileId: p.id,
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    isPrivate: !!p.isPrivate,
    role: ROLE_BY_NUMBER[p.role] ?? null,
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
