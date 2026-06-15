// Social module types — symmetric account-based follow/block.

import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

export { FollowStatus };

// View shapes returned from BFFs (mapper-translated from profile.v1.Profile proto)
export interface SocialAccountView {
  accountId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPrivate: boolean;
}

export type FollowStatusMap = Record<string, FollowStatus>;
export type BlockStatusMap = Record<string, boolean>;

// Cursor-paginated list response (BFF -> hook)
export interface PaginatedProfilesResponse {
  profiles: SocialAccountView[];
  nextCursor: string;
  hasMore: boolean;
}

// pending request item (kept symmetric to ListPendingFollowRequests)
export interface FollowRequestItem {
  requesterAccountId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}
