/**
 * Proto の Relationship オブジェクトを API レスポンス用 JSON にマッピング。
 * API route (BFF) で使用。
 */

interface ProtoBlockedUser {
  id: string;
  userType: string;
  name: string;
  imageUrl: string;
  blockedAt: string;
}

interface ProtoFollowRequest {
  guestId: string;
  guestName: string;
  guestImageUrl: string;
  requestedAt: string;
}

export function mapProtoBlockedUserToJson(user: ProtoBlockedUser) {
  return {
    id: user.id,
    userType: user.userType,
    name: user.name,
    imageUrl: user.imageUrl,
    blockedAt: user.blockedAt,
  };
}

export function mapProtoBlockedListToJson(response: {
  users: ProtoBlockedUser[];
  nextCursor: string;
  hasMore: boolean;
}) {
  return {
    users: response.users.map(mapProtoBlockedUserToJson),
    nextCursor: response.nextCursor,
    hasMore: response.hasMore,
  };
}

export function mapProtoFollowRequestToJson(request: ProtoFollowRequest) {
  return {
    guestId: request.guestId,
    guestName: request.guestName,
    guestImageUrl: request.guestImageUrl,
    requestedAt: request.requestedAt,
  };
}

export function mapProtoFollowRequestsListToJson(response: {
  requests: ProtoFollowRequest[];
  nextCursor: string;
  hasMore: boolean;
}) {
  return {
    requests: (response.requests || []).map(mapProtoFollowRequestToJson),
    nextCursor: response.nextCursor,
    hasMore: response.hasMore,
  };
}
