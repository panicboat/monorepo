import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ReviewCountsSchema, ReviewEventSchema, ReviewSchema, ReviewStage, ReviewStatus, RatingSummarySchema } from "@/stub/review/v1/service_pb";
import { eventInputToMessage, mapCountsToView, mapReviewToView, mapSummaryToView } from "./mappers";

describe("mapReviewToView", () => {
  it("maps a review with its events", () => {
    const view = mapReviewToView(
      create(ReviewSchema, {
        id: "k-1",
        authorProfileId: "author",
        authorUsername: "cast_taro",
        targetProfileId: "target",
        targetUsername: "cast_hanako",
        isMine: true,
        rating: 4,
        status: ReviewStatus.CLOSED,
        closedAt: { seconds: BigInt(1_700_000_000), nanos: 0 },
        events: [
          create(ReviewEventSchema, { id: "e-1", stage: ReviewStage.AFTERCARE, outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }),
        ],
      })
    );

    expect(view).toMatchObject({
      id: "k-1",
      authorUsername: "cast_taro",
      targetUsername: "cast_hanako",
      isMine: true,
      rating: 4,
      status: "closed",
      closedAt: new Date(1_700_000_000 * 1000).toISOString(),
      events: [{ id: "e-1", stage: "aftercare", outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }],
    });
  });

  it("reads rating 0 as unrated and a missing close time as null", () => {
    const view = mapReviewToView(create(ReviewSchema, { id: "k-1", rating: 0, status: ReviewStatus.OPEN }));

    expect(view.rating).toBeNull();
    expect(view.status).toBe("open");
    expect(view.closedAt).toBeNull();
    expect(view.authorUsername).toBe("");
    expect(view.events).toEqual([]);
  });

  it("maps each stage", () => {
    const stages = [ReviewStage.RESERVATION, ReviewStage.SERVICE, ReviewStage.AFTERCARE].map(
      (stage) => mapReviewToView(create(ReviewSchema, { events: [create(ReviewEventSchema, { stage })] })).events[0].stage
    );

    expect(stages).toEqual(["reservation", "service", "aftercare"]);
  });

  it("maps the display names and the last activity", () => {
    const view = mapReviewToView(
      create(ReviewSchema, {
        id: "k-1",
        authorDisplayName: "ゆな",
        targetDisplayName: "はなこ",
        lastActivityAt: { seconds: BigInt(1_700_000_000), nanos: 0 },
      })
    );

    expect(view.authorDisplayName).toBe("ゆな");
    expect(view.targetDisplayName).toBe("はなこ");
    expect(view.lastActivityAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
});

describe("mapSummaryToView", () => {
  it("passes the average through when closed reviews exist", () => {
    expect(mapSummaryToView(create(RatingSummarySchema, { averageRating: 3.8, raterCount: 8, reviewCount: 12 }))).toEqual({
      averageRating: 3.8,
      raterCount: 8,
      reviewCount: 12,
    });
  });

  it("reports no average without closed reviews", () => {
    expect(mapSummaryToView(create(RatingSummarySchema, {}))).toEqual({ averageRating: null, raterCount: 0, reviewCount: 0 });
    expect(mapSummaryToView(undefined)).toEqual({ averageRating: null, raterCount: 0, reviewCount: 0 });
  });
});

describe("eventInputToMessage", () => {
  it("turns the stage into the proto enum", () => {
    expect(eventInputToMessage({ stage: "service", outcome: "satisfied", tags: ["late"], note: "", occurredOn: "2026-10-01" })).toEqual({
      stage: ReviewStage.SERVICE,
      outcome: "satisfied",
      tags: ["late"],
      note: "",
      occurredOn: "2026-10-01",
    });
  });
});

describe("mapCountsToView", () => {
  it("maps the counts and reads missing counts as zero", () => {
    expect(mapCountsToView(create(ReviewCountsSchema, { totalCount: 3, openCount: 2, closedCount: 1 }))).toEqual({ total: 3, open: 2, closed: 1 });
    expect(mapCountsToView(undefined)).toEqual({ total: 0, open: 0, closed: 0 });
  });
});
