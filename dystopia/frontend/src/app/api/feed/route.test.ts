import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";

const feed = vi.hoisted(() => ({ listFeed: vi.fn() }));

vi.mock("@/lib/grpc", () => ({ feedClient: feed }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const { GET } = await import("./route");

function list(params: Record<string, string>) {
  const url = new URL("http://localhost/api/feed");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const req = new NextRequest(url);
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("GET /api/feed", () => {
  beforeEach(() => {
    feed.listFeed.mockReset().mockResolvedValue({ posts: [], nextCursor: "", hasMore: false });
  });

  it("does not forward a prefecture query to the feed service", async () => {
    await GET(list({ filter: "area", prefecture: "大阪府" }));

    expect(feed.listFeed).toHaveBeenCalledTimes(1);
    expect(feed.listFeed).toHaveBeenCalledWith(
      expect.not.objectContaining({ prefecture: expect.anything() }),
      expect.anything()
    );
  });
});
