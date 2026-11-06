import { describe, expect, it } from "vitest";
import { parseReviewEventInput, parseRating } from "./input";

describe("parseReviewEventInput", () => {
  it("accepts a well-formed event and defaults a missing note", () => {
    expect(parseReviewEventInput({ stage: "service", outcome: "satisfied", tags: ["late"], occurredOn: "2026-10-01" })).toEqual({
      stage: "service",
      outcome: "satisfied",
      tags: ["late"],
      note: "",
      occurredOn: "2026-10-01",
      media: [],
    });
  });

  it("keeps the id and type of each media and drops the rest of a media entry", () => {
    const event = { stage: "service", outcome: "satisfied", tags: [], occurredOn: "2026-10-01" };

    expect(parseReviewEventInput({ ...event, media: [{ mediaId: "m-1", mediaType: "image", url: "u", thumbnailUrl: "t" }] })?.media).toEqual([
      { mediaId: "m-1", mediaType: "image", url: "", thumbnailUrl: "" },
    ]);
    expect(parseReviewEventInput({ ...event, media: [{ mediaId: "m-2", mediaType: "video" }] })?.media).toEqual([
      { mediaId: "m-2", mediaType: "video", url: "", thumbnailUrl: "" },
    ]);
  });

  it("rejects a media entry that is not an id and an image or video type", () => {
    const event = { stage: "service", outcome: "satisfied", tags: [], occurredOn: "2026-10-01" };

    expect(parseReviewEventInput({ ...event, media: "m-1" })).toBeNull();
    expect(parseReviewEventInput({ ...event, media: [null] })).toBeNull();
    expect(parseReviewEventInput({ ...event, media: [{ mediaId: 1, mediaType: "image" }] })).toBeNull();
    expect(parseReviewEventInput({ ...event, media: [{ mediaId: "m-1", mediaType: "audio" }] })).toBeNull();
    expect(parseReviewEventInput({ ...event, media: [{ mediaType: "image" }] })).toBeNull();
  });

  it("rejects an unknown stage, a non-string field and non-string tags", () => {
    expect(parseReviewEventInput({ stage: "after", outcome: "x", tags: [], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseReviewEventInput({ stage: "service", outcome: 1, tags: [], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseReviewEventInput({ stage: "service", outcome: "satisfied", tags: [1], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseReviewEventInput(null)).toBeNull();
  });
});

describe("parseRating", () => {
  it("passes integers through for the server to check and reads anything else as unrated", () => {
    expect(parseRating(4)).toBe(4);
    expect(parseRating(9)).toBe(9);
    expect(parseRating(null)).toBe(0);
    expect(parseRating("4")).toBe(0);
    expect(parseRating(3.5)).toBe(0);
  });
});
