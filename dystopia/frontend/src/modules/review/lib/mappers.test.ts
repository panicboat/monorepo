import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ProfileSummarySchema } from "@/stub/profile/v1/service_pb";
import { RatingSummarySchema, ReviewCountsSchema, ReviewEventMediaSchema, ReviewEventSchema, ReviewSchema, ReviewStage } from "@/stub/review/v1/service_pb";
import { eventInputToMessage, mapCountsToView, mapReviewEventToView, mapReviewToView, mapSummaryToView } from "./mappers";

describe("mapReviewToView", () => {
  it("maps a review with its events", () => {
    const view = mapReviewToView(
      create(ReviewSchema, {
        id: "k-1",
        authorProfileId: "author",
        author: create(ProfileSummarySchema, { profileId: "author", username: "cast_taro", displayName: "たろう", avatarUrl: "a.png", isPrivate: true, role: 2 }),
        targetProfileId: "target",
        target: create(ProfileSummarySchema, { profileId: "target", username: "cast_hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: 1 }),
        isMine: true,
        rating: 4,
        events: [
          create(ReviewEventSchema, { id: "e-1", stage: ReviewStage.AFTERCARE, outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }),
        ],
      })
    );

    expect(view).toMatchObject({
      id: "k-1",
      author: { profileId: "author", username: "cast_taro", displayName: "たろう", avatarUrl: "a.png", isPrivate: true, role: "cast" },
      target: { profileId: "target", username: "cast_hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest" },
      isMine: true,
      rating: 4,
      events: [{ id: "e-1", stage: "aftercare", outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }],
    });
  });

  it("maps authorHidden", () => {
    expect(mapReviewToView(create(ReviewSchema, { id: "k-1", authorHidden: true })).authorHidden).toBe(true);
    expect(mapReviewToView(create(ReviewSchema, { id: "k-1" })).authorHidden).toBe(false);
  });

  it("reads rating 0 as unrated and carries no status", () => {
    const view = mapReviewToView(create(ReviewSchema, { id: "k-1", rating: 0 }));

    expect(view.rating).toBeNull();
    expect(view).not.toHaveProperty("status");
    expect(view).not.toHaveProperty("closedAt");
    expect(view.author).toBeNull();
    expect(view.target).toBeNull();
    expect(view.events).toEqual([]);
  });

  it("maps each stage", () => {
    const stages = [ReviewStage.RESERVATION, ReviewStage.SERVICE, ReviewStage.AFTERCARE].map(
      (stage) => mapReviewToView(create(ReviewSchema, { events: [create(ReviewEventSchema, { stage })] })).events[0].stage
    );

    expect(stages).toEqual(["reservation", "service", "aftercare"]);
  });

  it("maps the last activity", () => {
    const view = mapReviewToView(
      create(ReviewSchema, {
        id: "k-1",
        lastActivityAt: { seconds: BigInt(1_700_000_000), nanos: 0 },
      })
    );

    expect(view.lastActivityAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
});

describe("mapReviewEventToView", () => {
  it("maps media and drops a media type other than image or video", () => {
    const view = mapReviewEventToView(
      create(ReviewEventSchema, {
        id: "e-1",
        media: [
          create(ReviewEventMediaSchema, { mediaId: "m-1", mediaType: "image", url: "https://cdn/m-1.jpg", thumbnailUrl: "https://cdn/m-1-t.jpg" }),
          create(ReviewEventMediaSchema, { mediaId: "m-2", mediaType: "video", url: "https://cdn/m-2.mp4", thumbnailUrl: "" }),
          create(ReviewEventMediaSchema, { mediaId: "m-3", mediaType: "audio", url: "https://cdn/m-3.mp3", thumbnailUrl: "" }),
        ],
      })
    );

    expect(view.media).toEqual([
      { mediaId: "m-1", mediaType: "image", url: "https://cdn/m-1.jpg", thumbnailUrl: "https://cdn/m-1-t.jpg" },
      { mediaId: "m-2", mediaType: "video", url: "https://cdn/m-2.mp4", thumbnailUrl: "" },
    ]);
  });

  it("reads an event without media as an empty list", () => {
    expect(mapReviewEventToView(create(ReviewEventSchema, { id: "e-1" })).media).toEqual([]);
  });
});

describe("mapSummaryToView", () => {
  it("passes the average through when rated reviews exist", () => {
    expect(mapSummaryToView(create(RatingSummarySchema, { averageRating: 3.8, raterCount: 8, reviewCount: 12 }))).toEqual({
      averageRating: 3.8,
      raterCount: 8,
      reviewCount: 12,
    });
  });

  it("reports no average without rated reviews", () => {
    expect(mapSummaryToView(create(RatingSummarySchema, {}))).toEqual({ averageRating: null, raterCount: 0, reviewCount: 0 });
    expect(mapSummaryToView(undefined)).toEqual({ averageRating: null, raterCount: 0, reviewCount: 0 });
  });
});

describe("eventInputToMessage", () => {
  it("turns the stage into the proto enum", () => {
    expect(eventInputToMessage({ stage: "service", outcome: "satisfied", tags: ["late"], note: "", occurredOn: "2026-10-01", media: [] })).toEqual({
      stage: ReviewStage.SERVICE,
      outcome: "satisfied",
      tags: ["late"],
      note: "",
      occurredOn: "2026-10-01",
      media: [],
    });
  });

  it("sends only the id and type of each media", () => {
    const message = eventInputToMessage({
      stage: "service",
      outcome: "satisfied",
      tags: [],
      note: "",
      occurredOn: "2026-10-01",
      media: [{ mediaId: "m-1", mediaType: "image", url: "https://cdn/m-1.jpg", thumbnailUrl: "https://cdn/m-1-t.jpg" }],
    });

    expect(message.media).toEqual([{ mediaId: "m-1", mediaType: "image" }]);
  });
});

describe("mapCountsToView", () => {
  it("maps the counts and reads missing counts as zero", () => {
    expect(mapCountsToView(create(ReviewCountsSchema, { totalCount: 3, unratedCount: 2 }))).toEqual({ total: 3, unrated: 2 });
    expect(mapCountsToView(undefined)).toEqual({ total: 0, unrated: 0 });
  });
});
