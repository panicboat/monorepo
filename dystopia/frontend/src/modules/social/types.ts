
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

export { FollowStatus };

export interface SocialAccountView {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPrivate: boolean;
}

export type FollowStatusMap = Record<string, FollowStatus>;
export type BlockStatusMap = Record<string, boolean>;

export interface PaginatedProfilesResponse {
  profiles: SocialAccountView[];
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
