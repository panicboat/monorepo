import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { create } from "@bufbuild/protobuf";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { ReviewSchema, ReviewStage, RatingSummarySchema } from "@/stub/review/v1/service_pb";

const reviewClient = vi.hoisted(() => ({
  createReview: vi.fn(),
  getReview: vi.fn(),
  updateReviewRating: vi.fn(),
  deleteReview: vi.fn(),
  addReviewEvent: vi.fn(),
  updateReviewEvent: vi.fn(),
  deleteReviewEvent: vi.fn(),
  listReviewsByTarget: vi.fn(),
  listReviewsByAuthor: vi.fn(),
  listMyReviews: vi.fn(),
  listRecentReviews: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({ reviewClient }));
vi.mock("@/lib/request", () => ({ buildGrpcHeaders: vi.fn(async () => ({ "x-profile-id": "viewer-1" })) }));

const root = await import("./route");
const one = await import("./[id]/route");
const rating = await import("./[id]/rating/route");
const events = await import("./[id]/events/route");
const event = await import("./events/[eventId]/route");
const byTarget = await import("./by-target/route");
const byAuthor = await import("./by-author/route");
const my = await import("./my/route");
const recent = await import("./recent/route");

const review = create(ReviewSchema, { id: "k-1", rating: 0 });
const eventBody = { stage: "service", outcome: "satisfied", tags: ["late"], note: "遅刻", occurredOn: "2026-10-01" };
const eventMessage = { stage: ReviewStage.SERVICE, outcome: "satisfied", tags: ["late"], note: "遅刻", occurredOn: "2026-10-01" };

function request(url: string, method: string, body?: unknown, signedIn = true) {
  const req = new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body) });
  if (signedIn) req.cookies.set(ACCESS_COOKIE, "token");
  return req;
}

const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });

beforeEach(() => {
  for (const fn of Object.values(reviewClient)) fn.mockReset().mockResolvedValue({ review });
});

describe("POST /api/review", () => {
  it("creates a review from the target, an optional rating and the first event", async () => {
    const res = await root.POST(request("/api/review", "POST", { targetProfileId: "cast-1", rating: null, event: eventBody }));

    expect(res.status).toBe(200);
    expect(reviewClient.createReview).toHaveBeenCalledWith({ targetProfileId: "cast-1", rating: 0, event: eventMessage }, expect.anything());
    expect((await res.json()).review).toMatchObject({ id: "k-1", rating: null });
  });

  it("rejects a request without a well-formed event", async () => {
    const res = await root.POST(request("/api/review", "POST", { targetProfileId: "cast-1", event: { stage: "after" } }));

    expect(res.status).toBe(400);
    expect(reviewClient.createReview).not.toHaveBeenCalled();
  });

  it("requires a signed-in viewer", async () => {
    const res = await root.POST(request("/api/review", "POST", { targetProfileId: "cast-1", event: eventBody }, false));

    expect(res.status).toBe(401);
  });
});

describe("one review", () => {
  it("reads and deletes a review", async () => {
    await one.GET(request("/api/review/k-1", "GET"), params({ id: "k-1" }));
    const deleted = await one.DELETE(request("/api/review/k-1", "DELETE"), params({ id: "k-1" }));

    expect(reviewClient.getReview).toHaveBeenCalledWith({ reviewId: "k-1" }, expect.anything());
    expect(reviewClient.deleteReview).toHaveBeenCalledWith({ reviewId: "k-1" }, expect.anything());
    expect(await deleted.json()).toEqual({ ok: true });
  });

  it("rates a review", async () => {
    await rating.PATCH(request("/api/review/k-1/rating", "PATCH", { rating: null }), params({ id: "k-1" }));

    expect(reviewClient.updateReviewRating).toHaveBeenCalledWith({ reviewId: "k-1", rating: 0 }, expect.anything());
  });

  it("adds, updates and deletes an event", async () => {
    await events.POST(request("/api/review/k-1/events", "POST", { event: eventBody }), params({ id: "k-1" }));
    await event.PATCH(request("/api/review/events/e-1", "PATCH", { event: eventBody }), params({ eventId: "e-1" }));
    const res = await event.DELETE(request("/api/review/events/e-1", "DELETE"), params({ eventId: "e-1" }));

    expect(reviewClient.addReviewEvent).toHaveBeenCalledWith({ reviewId: "k-1", event: eventMessage }, expect.anything());
    expect(reviewClient.updateReviewEvent).toHaveBeenCalledWith({ eventId: "e-1", event: eventMessage }, expect.anything());
    expect(reviewClient.deleteReviewEvent).toHaveBeenCalledWith({ eventId: "e-1" }, expect.anything());
    expect((await res.json()).review.id).toBe("k-1");
  });

  it("answers no review when deleting the last event removed it", async () => {
    reviewClient.deleteReviewEvent.mockResolvedValue({});

    const res = await event.DELETE(request("/api/review/events/e-1", "DELETE"), params({ eventId: "e-1" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ review: null });
  });

  it("answers 500 when the server returns no review", async () => {
    reviewClient.updateReviewRating.mockResolvedValue({});

    const res = await rating.PATCH(request("/api/review/k-1/rating", "PATCH", { rating: 4 }), params({ id: "k-1" }));

    expect(res.status).toBe(500);
  });
});

describe("review lists", () => {
  it("lists a cast's reviews with the summary", async () => {
    reviewClient.listReviewsByTarget.mockResolvedValue({
      reviews: [review],
      nextCursor: "next",
      hasMore: true,
      summary: create(RatingSummarySchema, { averageRating: 3.8, raterCount: 8, reviewCount: 12 }),
    });

    const res = await byTarget.GET(request("/api/review/by-target?profile_id=cast-1&cursor=c", "GET"));
    const body = await res.json();

    expect(reviewClient.listReviewsByTarget).toHaveBeenCalledWith({ targetProfileId: "cast-1", limit: 20, cursor: "c" }, expect.anything());
    expect(body).toMatchObject({ nextCursor: "next", hasMore: true, summary: { averageRating: 3.8, raterCount: 8, reviewCount: 12 } });
    expect(body.reviews).toHaveLength(1);
  });

  it("passes hiddenByLock through on a cast's reviews and on an author's reviews", async () => {
    reviewClient.listReviewsByTarget.mockResolvedValue({ reviews: [], nextCursor: "", hasMore: false, hiddenByLock: true });
    reviewClient.listReviewsByAuthor.mockResolvedValue({ reviews: [], nextCursor: "", hasMore: false, hiddenByLock: true });

    const target = await (await byTarget.GET(request("/api/review/by-target?profile_id=cast-1", "GET"))).json();
    const author = await (await byAuthor.GET(request("/api/review/by-author?profile_id=author-1", "GET"))).json();

    expect(target.hiddenByLock).toBe(true);
    expect(author.hiddenByLock).toBe(true);
  });

  it("answers hiddenByLock false when the server does not hide the reviews", async () => {
    reviewClient.listReviewsByTarget.mockResolvedValue({ reviews: [review], nextCursor: "", hasMore: false });
    reviewClient.listReviewsByAuthor.mockResolvedValue({ reviews: [review], nextCursor: "", hasMore: false });

    const target = await (await byTarget.GET(request("/api/review/by-target?profile_id=cast-1", "GET"))).json();
    const author = await (await byAuthor.GET(request("/api/review/by-author?profile_id=author-1", "GET"))).json();

    expect(target.hiddenByLock).toBe(false);
    expect(author.hiddenByLock).toBe(false);
  });

  it("requires the profile id for a cast's reviews", async () => {
    const res = await byTarget.GET(request("/api/review/by-target", "GET"));

    expect(res.status).toBe(400);
  });

  it("lists the reviews an author wrote without a summary", async () => {
    reviewClient.listReviewsByAuthor.mockResolvedValue({ reviews: [review], nextCursor: "", hasMore: false });

    const res = await byAuthor.GET(request("/api/review/by-author?profile_id=author-1", "GET"));
    const body = await res.json();

    expect(reviewClient.listReviewsByAuthor).toHaveBeenCalledWith({ authorProfileId: "author-1", limit: 20, cursor: "" }, expect.anything());
    expect(body.reviews).toHaveLength(1);
    expect(body).not.toHaveProperty("summary");
  });

  it("requires the profile id for an author's reviews", async () => {
    const res = await byAuthor.GET(request("/api/review/by-author", "GET"));

    expect(res.status).toBe(400);
  });

  it("lists my reviews and recent reviews", async () => {
    reviewClient.listMyReviews.mockResolvedValue({ reviews: [review], nextCursor: "", hasMore: false });
    reviewClient.listRecentReviews.mockResolvedValue({ reviews: [], nextCursor: "", hasMore: false });

    const mine = await (await my.GET(request("/api/review/my", "GET"))).json();
    const latest = await (await recent.GET(request("/api/review/recent?cursor=c", "GET"))).json();

    expect(mine).toMatchObject({ hasMore: false, nextCursor: "" });
    expect(mine.reviews).toHaveLength(1);
    expect(latest.reviews).toEqual([]);
    expect(reviewClient.listRecentReviews).toHaveBeenCalledWith({ limit: 20, cursor: "c" }, expect.anything());
  });
});
