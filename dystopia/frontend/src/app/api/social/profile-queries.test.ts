import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const follow = vi.hoisted(() => ({
  follow: vi.fn(),
  unfollow: vi.fn(),
  cancelFollowRequest: vi.fn(),
  approveFollowRequest: vi.fn(),
  rejectFollowRequest: vi.fn(),
  getFollowStatus: vi.fn(),
  listFollowing: vi.fn(),
  listFollowers: vi.fn(),
  getSocialCounts: vi.fn(),
}));
const block = vi.hoisted(() => ({
  block: vi.fn(),
  unblock: vi.fn(),
  getBlockStatus: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ socialFollowClient: follow, socialBlockClient: block }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const followRoute = await import("./follow/route");
const followStatusRoute = await import("./follow/status/route");
const approveRoute = await import("./follow/requests/[requesterProfileId]/approve/route");
const rejectRoute = await import("./follow/requests/[requesterProfileId]/reject/route");
const followingRoute = await import("./following/route");
const followersRoute = await import("./followers/route");
const countsRoute = await import("./counts/route");
const blocksRoute = await import("./blocks/route");
const blockStatusRoute = await import("./blocks/status/route");

function request(method: string, path: string, body?: unknown) {
  const req = new NextRequest(`http://localhost${path}`, {
    method,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const list = { profiles: [], nextCursor: "", hasMore: false };

describe("social routes address other profiles by profile id", () => {
  beforeEach(() => {
    Object.values(follow).forEach((fn) => fn.mockReset().mockResolvedValue({ ...list, statuses: {} }));
    Object.values(block).forEach((fn) => fn.mockReset().mockResolvedValue({ blocked: {} }));
  });

  it("POST /api/social/follow sends targetProfileId and rejects targetAccountId", async () => {
    const ok = await followRoute.POST(request("POST", "/api/social/follow", { targetProfileId: "prof-1" }));
    const rejected = await followRoute.POST(request("POST", "/api/social/follow", { targetAccountId: "prof-1" }));

    expect(ok.status).toBe(200);
    expect(rejected.status).toBe(400);
    expect(follow.follow).toHaveBeenCalledTimes(1);
    expect(follow.follow).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
  });

  it("DELETE /api/social/follow reads target_profile_id for unfollow and for cancel", async () => {
    await followRoute.DELETE(request("DELETE", "/api/social/follow?target_profile_id=prof-1"));
    await followRoute.DELETE(request("DELETE", "/api/social/follow?target_profile_id=prof-2&cancel=1"));
    const rejected = await followRoute.DELETE(request("DELETE", "/api/social/follow?target_account_id=prof-1"));

    expect(follow.unfollow).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
    expect(follow.cancelFollowRequest).toHaveBeenCalledWith({ targetProfileId: "prof-2" }, expect.anything());
    expect(rejected.status).toBe(400);
  });

  it("POST /api/social/follow/status sends targetProfileIds", async () => {
    await followStatusRoute.POST(request("POST", "/api/social/follow/status", { targetProfileIds: ["prof-1", "prof-2"] }));

    expect(follow.getFollowStatus).toHaveBeenCalledWith({ targetProfileIds: ["prof-1", "prof-2"] }, expect.anything());
  });

  it("approve and reject take the requester profile from the path", async () => {
    const params = Promise.resolve({ requesterProfileId: "prof-9" });
    await approveRoute.POST(request("POST", "/api/social/follow/requests/prof-9/approve"), { params });
    await rejectRoute.POST(request("POST", "/api/social/follow/requests/prof-9/reject"), { params });

    expect(follow.approveFollowRequest).toHaveBeenCalledWith({ requesterProfileId: "prof-9" }, expect.anything());
    expect(follow.rejectFollowRequest).toHaveBeenCalledWith({ requesterProfileId: "prof-9" }, expect.anything());
  });

  it("following, followers and counts read profile_id", async () => {
    await followingRoute.GET(request("GET", "/api/social/following?profile_id=prof-1"));
    await followersRoute.GET(request("GET", "/api/social/followers?profile_id=prof-1"));
    await countsRoute.GET(request("GET", "/api/social/counts?profile_id=prof-1"));

    expect(follow.listFollowing).toHaveBeenCalledWith(expect.objectContaining({ profileId: "prof-1" }), expect.anything());
    expect(follow.listFollowers).toHaveBeenCalledWith(expect.objectContaining({ profileId: "prof-1" }), expect.anything());
    expect(follow.getSocialCounts).toHaveBeenCalledWith({ profileId: "prof-1" }, expect.anything());
  });

  it("block, unblock and block status address the target by profile id", async () => {
    await blocksRoute.POST(request("POST", "/api/social/blocks", { targetProfileId: "prof-1" }));
    await blocksRoute.DELETE(request("DELETE", "/api/social/blocks?target_profile_id=prof-1"));
    await blockStatusRoute.POST(request("POST", "/api/social/blocks/status", { targetProfileIds: ["prof-1"] }));

    expect(block.block).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
    expect(block.unblock).toHaveBeenCalledWith({ targetProfileId: "prof-1" }, expect.anything());
    expect(block.getBlockStatus).toHaveBeenCalledWith({ targetProfileIds: ["prof-1"] }, expect.anything());
  });
});
