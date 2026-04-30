// Relationship module types

import { FollowStatus } from "@/stub/relationship/v1/follow_service_pb";

export { FollowStatus };

// Follow types
export interface FollowingCast {
  id: string;
  name: string;
  imageUrl: string;
  area: string;
}

export interface FollowState {
  [castId: string]: FollowStatus;
}

// Follow request types (for cast-side management)
export interface FollowRequest {
  guestId: string;
  guestName: string;
  guestImageUrl: string;
  requestedAt: string;
}



