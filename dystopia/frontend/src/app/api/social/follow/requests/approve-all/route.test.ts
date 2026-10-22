import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const follow = vi.hoisted(() => ({ approveAllFollowRequests: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ socialFollowClient: follow }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { POST } = await import("./route");

describe("POST /api/social/follow/requests/approve-all", () => {
  it("approves every pending request and answers how many were approved", async () => {
    follow.approveAllFollowRequests.mockResolvedValue({ approvedCount: 3 });
    const req = new NextRequest("http://localhost/api/social/follow/requests/approve-all", { method: "POST" });
    req.cookies.set(ACCESS_COOKIE, "token");

    const res = await POST(req);

    expect(follow.approveAllFollowRequests).toHaveBeenCalledWith({}, expect.objectContaining({ headers: expect.any(Object) }));
    expect(await res.json()).toEqual({ approvedCount: 3 });
  });
});
