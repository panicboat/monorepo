
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";
import type { Role } from "@/lib/auth";

export { FollowStatus };

export interface SocialProfileView {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPrivate: boolean;
  role: Role | null;
}

export type FollowStatusMap = Record<string, FollowStatus>;
export type BlockStatusMap = Record<string, boolean>;

export interface PaginatedProfilesResponse {
  profiles: SocialProfileView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface FollowRequestItem {
  requesterProfileId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface SocialCounts {
  followingCount: number;
  followersCount: number;
}
