import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ReviewEntrySchema } from "@/stub/review/v1/service_pb";

const review = vi.hoisted(() => ({
  createEntry: vi.fn(),
  listEntriesByTarget: vi.fn(),
  listEntriesByAuthor: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ reviewClient: review }));
vi.mock("@/lib/request", () => ({
  buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })),
}));

const createRoute = await import("./route");
const byTargetRoute = await import("./by-target/route");
const byAuthorRoute = await import("./by-author/route");

function request(path: string, body?: unknown) {
  const req = new NextRequest(`http://localhost${path}`, body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) });
  req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

describe("review routes address the author and the target by profile id", () => {
  beforeEach(() => {
    const entry = create(ReviewEntrySchema, { id: "r-1", authorProfileId: "author-1", targetProfileId: "target-1", rating: 4.5 });
    review.createEntry.mockReset().mockResolvedValue({ entry });
    review.listEntriesByTarget.mockReset().mockResolvedValue({ entries: [entry], nextCursor: "", hasMore: false });
    review.listEntriesByAuthor.mockReset().mockResolvedValue({ entries: [entry], nextCursor: "", hasMore: false });
  });

  it("POST /api/review creates a review about targetProfileId and returns both profile ids", async () => {
    const res = await createRoute.POST(request("/api/review", { targetProfileId: "target-1", rating: 4.5, body: "great" }));

    expect(review.createEntry).toHaveBeenCalledWith({ targetProfileId: "target-1", rating: 4.5, body: "great" }, expect.anything());
    expect((await res.json()).entry).toMatchObject({ id: "r-1", authorProfileId: "author-1", targetProfileId: "target-1" });
  });

  it("POST /api/review rejects targetAccountId", async () => {
    const res = await createRoute.POST(request("/api/review", { targetAccountId: "target-1", rating: 4.5, body: "great" }));

    expect(res.status).toBe(400);
    expect(review.createEntry).not.toHaveBeenCalled();
  });

  it("GET /api/review/by-target reads the profile_id query and rejects account_id", async () => {
    const ok = await byTargetRoute.GET(request("/api/review/by-target?profile_id=target-1"));
    const rejected = await byTargetRoute.GET(request("/api/review/by-target?account_id=target-1"));

    expect(rejected.status).toBe(400);
    expect(review.listEntriesByTarget).toHaveBeenCalledTimes(1);
    expect(review.listEntriesByTarget.mock.calls[0][0]).toMatchObject({ targetProfileId: "target-1" });
    expect((await ok.json()).entries).toMatchObject([{ authorProfileId: "author-1", targetProfileId: "target-1" }]);
  });

  it("GET /api/review/by-author reads the profile_id query and rejects account_id", async () => {
    const ok = await byAuthorRoute.GET(request("/api/review/by-author?profile_id=author-1"));
    const rejected = await byAuthorRoute.GET(request("/api/review/by-author?account_id=author-1"));

    expect(rejected.status).toBe(400);
    expect(review.listEntriesByAuthor).toHaveBeenCalledTimes(1);
    expect(review.listEntriesByAuthor.mock.calls[0][0]).toMatchObject({ authorProfileId: "author-1" });
    expect((await ok.json()).entries).toMatchObject([{ authorProfileId: "author-1", targetProfileId: "target-1" }]);
  });
});
