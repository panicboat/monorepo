import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ProfileSummarySchema } from "@/stub/profile/v1/service_pb";
import { KarteCountsSchema, KarteEventSchema, KarteSchema, KarteStage, KarteStatus, ReliabilitySummarySchema } from "@/stub/karte/v1/service_pb";
import { eventInputToMessage, mapCountsToView, mapKarteToView, mapReliabilityToView } from "./mappers";

describe("mapKarteToView", () => {
  it("maps a karte with its events", () => {
    const view = mapKarteToView(
      create(KarteSchema, {
        id: "k-1",
        authorProfileId: "author",
        author: create(ProfileSummarySchema, { profileId: "author", username: "cast_taro", displayName: "たろう", avatarUrl: "a.png", isPrivate: true, role: 2 }),
        targetProfileId: "target",
        target: create(ProfileSummarySchema, { profileId: "target", username: "guest_hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: 1 }),
        isMine: true,
        rating: 4,
        status: KarteStatus.CLOSED,
        closedAt: { seconds: BigInt(1_700_000_000), nanos: 0 },
        events: [
          create(KarteEventSchema, { id: "e-1", stage: KarteStage.AFTERCARE, outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }),
        ],
      })
    );

    expect(view).toMatchObject({
      id: "k-1",
      author: { profileId: "author", username: "cast_taro", displayName: "たろう", avatarUrl: "a.png", isPrivate: true, role: "cast" },
      target: { profileId: "target", username: "guest_hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest" },
      isMine: true,
      rating: 4,
      status: "closed",
      closedAt: new Date(1_700_000_000 * 1000).toISOString(),
      events: [{ id: "e-1", stage: "aftercare", outcome: "trouble_occurred", tags: ["excessive_contact"], note: "頻繁", occurredOn: "2026-10-01" }],
    });
  });

  it("reads rating 0 as unrated and a missing close time as null", () => {
    const view = mapKarteToView(create(KarteSchema, { id: "k-1", rating: 0, status: KarteStatus.OPEN }));

    expect(view.rating).toBeNull();
    expect(view.status).toBe("open");
    expect(view.closedAt).toBeNull();
    expect(view.author).toBeNull();
    expect(view.target).toBeNull();
    expect(view.events).toEqual([]);
  });

  it("maps each stage", () => {
    const stages = [KarteStage.RESERVATION, KarteStage.SERVICE, KarteStage.AFTERCARE].map(
      (stage) => mapKarteToView(create(KarteSchema, { events: [create(KarteEventSchema, { stage })] })).events[0].stage
    );

    expect(stages).toEqual(["reservation", "service", "aftercare"]);
  });

  it("maps the last activity", () => {
    const view = mapKarteToView(
      create(KarteSchema, {
        id: "k-1",
        lastActivityAt: { seconds: BigInt(1_700_000_000), nanos: 0 },
      })
    );

    expect(view.lastActivityAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });
});

describe("mapReliabilityToView", () => {
  it("passes the average through when closed kartes exist", () => {
    expect(mapReliabilityToView(create(ReliabilitySummarySchema, { averageRating: 3.8, raterCount: 8, karteCount: 12 }))).toEqual({
      averageRating: 3.8,
      raterCount: 8,
      karteCount: 12,
    });
  });

  it("reports no average without closed kartes", () => {
    expect(mapReliabilityToView(create(ReliabilitySummarySchema, {}))).toEqual({ averageRating: null, raterCount: 0, karteCount: 0 });
    expect(mapReliabilityToView(undefined)).toEqual({ averageRating: null, raterCount: 0, karteCount: 0 });
  });
});

describe("eventInputToMessage", () => {
  it("turns the stage into the proto enum", () => {
    expect(eventInputToMessage({ stage: "service", outcome: "completed", tags: ["late"], note: "", occurredOn: "2026-10-01" })).toEqual({
      stage: KarteStage.SERVICE,
      outcome: "completed",
      tags: ["late"],
      note: "",
      occurredOn: "2026-10-01",
    });
  });
});

describe("mapCountsToView", () => {
  it("maps the counts and reads missing counts as zero", () => {
    expect(mapCountsToView(create(KarteCountsSchema, { totalCount: 3, openCount: 2, closedCount: 1 }))).toEqual({ total: 3, open: 2, closed: 1 });
    expect(mapCountsToView(undefined)).toEqual({ total: 0, open: 0, closed: 0 });
  });
});
