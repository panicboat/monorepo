import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const follow = vi.hoisted(() => ({ getFollowStatus: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ socialFollowClient: follow }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { POST } = await import("./route");

function request(body: unknown) {
  const req = new NextRequest("http://localhost/api/social/follow/status", { method: "POST", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("POST /api/social/follow/status", () => {
  it("returns the statuses with whether each target requires approval", async () => {
    follow.getFollowStatus.mockResolvedValue({ statuses: { "p-1": 1 }, approvalRequired: { "p-1": true } });

    const body = await (await POST(request({ targetProfileIds: ["p-1"] }))).json();

    expect(body).toEqual({ statuses: { "p-1": 1 }, approvalRequired: { "p-1": true } });
  });

  it("answers empty maps without calling the monolith when no target is given", async () => {
    follow.getFollowStatus.mockClear();

    const body = await (await POST(request({ targetProfileIds: [] }))).json();

    expect(body).toEqual({ statuses: {}, approvalRequired: {} });
    expect(follow.getFollowStatus).not.toHaveBeenCalled();
  });
});
