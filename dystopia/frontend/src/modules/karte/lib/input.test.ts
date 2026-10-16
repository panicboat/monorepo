import { describe, expect, it } from "vitest";
import { parseKarteEventInput, parseRating } from "./input";

describe("parseKarteEventInput", () => {
  it("accepts a well-formed event and defaults a missing note", () => {
    expect(parseKarteEventInput({ stage: "service", outcome: "completed", tags: ["late"], occurredOn: "2026-10-01" })).toEqual({
      stage: "service",
      outcome: "completed",
      tags: ["late"],
      note: "",
      occurredOn: "2026-10-01",
    });
  });

  it("rejects an unknown stage, a non-string field and non-string tags", () => {
    expect(parseKarteEventInput({ stage: "after", outcome: "x", tags: [], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseKarteEventInput({ stage: "service", outcome: 1, tags: [], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseKarteEventInput({ stage: "service", outcome: "completed", tags: [1], occurredOn: "2026-10-01" })).toBeNull();
    expect(parseKarteEventInput(null)).toBeNull();
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
