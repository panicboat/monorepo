
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";
import type { ProfileSummaryView } from "@/modules/profile/types";

export { FollowStatus };

export type FollowStatusMap = Record<string, FollowStatus>;
export type BlockStatusMap = Record<string, boolean>;

export interface PaginatedProfilesResponse {
  profiles: ProfileSummaryView[];
  nextCursor: string;
  hasMore: boolean;
}

export interface SocialCounts {
  followingCount: number;
  followersCount: number;
}
