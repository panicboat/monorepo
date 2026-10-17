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
    });
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
