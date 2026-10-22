import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const follows = vi.hoisted(() => ({ listFollowing: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ socialFollowClient: follows }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({})) }));

const { GET } = await import("./route");

function request(qs: string) {
  const req = new NextRequest(`http://localhost/api/social/following${qs}`);
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("/api/social/following", () => {
  beforeEach(() => {
    follows.listFollowing.mockReset();
    follows.listFollowing.mockResolvedValue({ profiles: [], nextCursor: "", hasMore: false });
  });

  it("narrows the follows by the query", async () => {
    await GET(request("?limit=5&q=%E3%81%95%E3%81%8F"));

    expect(follows.listFollowing).toHaveBeenCalledWith({ profileId: "", limit: 5, cursor: "", query: "さく" }, { headers: {} });
  });

  it("lists every follow without a query", async () => {
    await GET(request(""));

    expect(follows.listFollowing).toHaveBeenCalledWith({ profileId: "", limit: 20, cursor: "", query: "" }, { headers: {} });
  });
});
