import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const follow = vi.hoisted(() => ({ listPendingFollowRequests: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ socialFollowClient: follow }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { GET } = await import("./route");

describe("GET /api/social/follow/requests", () => {
  it("returns each requester as a profile summary including is_private", async () => {
    follow.listPendingFollowRequests.mockResolvedValue({
      profiles: [{ profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: true, role: 1 }],
      nextCursor: "",
      hasMore: false,
    });
    const req = new NextRequest("http://localhost/api/social/follow/requests");
    req.cookies.set(ACCESS_COOKIE, "token");

    const body = await (await GET(req)).json();

    expect(body.requests).toEqual([
      { profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: true, role: "guest" },
    ]);
  });
});
