import { describe, expect, it } from "vitest";
import { create, fromBinary, toBinary } from "@bufbuild/protobuf";
import { UpdateEntryRequestSchema } from "@/stub/karte/v1/service_pb";
import { japanToday, validateEvent, validateKarte } from "./validation";

const event = { stage: "booking", outcome: "confirmed", tags: [], note: "", occurredOn: "2026-10-12" };

describe("karte event validation", () => {
  it("accepts a result without optional tags or notes", () => expect(validateEvent(event)).toEqual({}));
  it.each([null, [], "booking", false])("rejects a non-object event: %j", (input) => {
    expect(validateEvent(input)).toHaveProperty("event");
  });
  it("rejects results belonging to another stage", () => {
    expect(validateEvent({ ...event, outcome: "ended_early" })).toHaveProperty("outcome");
  });
  it("rejects a stage with no matching catalog", () => {
    expect(validateEvent({ ...event, stage: "unknown" })).toHaveProperty("stage");
  });
  it.each([{ tags: ["payment_trouble"] }, { tags: ["smooth_contact", "smooth_contact"] }, { tags: "on_time" }])("rejects mismatched or duplicate tags: %j", ({ tags }) => {
    expect(validateEvent({ ...event, tags })).toHaveProperty("tags");
  });
  it.each([
    { stage: "booking", outcome: "no_show", tags: [] },
    { stage: "service", outcome: "ended_early", tags: [] },
    { stage: "after_service", outcome: "trouble", tags: [] },
    { stage: "booking", outcome: "confirmed", tags: ["unagreed_request"] },
    { stage: "service", outcome: "completed", tags: ["payment_trouble"] },
    { stage: "service", outcome: "completed", tags: ["beyond_agreement"] },
    { stage: "after_service", outcome: "inquiry", tags: ["terms_mismatch"] },
  ])("requires a note for a result or tag describing trouble: %j", (choice) => {
    expect(validateEvent({ ...event, ...choice, note: " \u3000\u00a0 " })).toHaveProperty("note");
    expect(validateEvent({ ...event, ...choice, note: "事前の合意と異なる要求があった" })).toEqual({});
  });
  it("accepts 500 emoji without counting surrogate halves", () => {
    expect(validateEvent({ ...event, note: "😀".repeat(500) })).toEqual({});
  });
  it("rejects the 501st character rather than truncating the note", () => {
    expect(validateEvent({ ...event, note: "😀".repeat(501) })).toHaveProperty("note");
  });
  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "2026-1-01", "", "2026-10-12T00:00:00Z"])("rejects an invalid date-only value: %s", (occurredOn) => {
    expect(validateEvent({ ...event, occurredOn })).toHaveProperty("occurredOn");
  });
  it("accepts leap day and a past event date", () => {
    expect(validateEvent({ ...event, occurredOn: "2028-02-29" })).toEqual({});
    expect(validateEvent({ ...event, occurredOn: "2020-01-01" })).toEqual({});
  });
  it("uses the Gregorian calendar for historic date input", () => {
    expect(validateEvent({ ...event, occurredOn: "1500-02-29" })).toHaveProperty("occurredOn");
    expect(validateEvent({ ...event, occurredOn: "1582-10-10" })).toEqual({});
  });
  it("does not accept Unicode line-space characters as a required note", () => {
    expect(validateEvent({ ...event, outcome: "no_show", note: "\u0085\ufeff" })).toHaveProperty("note");
    expect(validateKarte({ rating: 1, body: "\u0085", events: [event] })).toHaveProperty("note");
  });
  it.each([false, 1, null])("rejects a non-string note: %j", (note) => {
    expect(validateEvent({ ...event, note })).toHaveProperty("note");
  });
});

describe("karte rating validation", () => {
  it.each([undefined, null, 2, 3, 4, 5])("accepts an optional or in-range rating: %j", (rating) => {
    expect(validateKarte({ rating, body: "", events: [event] })).toEqual({});
  });
  it.each([0, 6, -1, 2.5, "3", false, NaN])("rejects a non-rating value: %j", (rating) => {
    expect(validateKarte({ rating, body: "", events: [event] })).toHaveProperty("rating");
  });
  it("requires at least one explanation for a one-star chart", () => {
    expect(validateKarte({ rating: 1, body: "", events: [event] })).toHaveProperty("note");
    expect(validateKarte({ rating: 1, body: "過去の説明", events: [] })).toEqual({});
    expect(validateKarte({ rating: 1, body: "", events: [{ ...event, note: "出来事の説明" }] })).toEqual({});
  });
});

describe("Japan date defaults", () => {
  it("uses the next date from Japan midnight regardless of local timezone", () => {
    expect(japanToday(new Date("2026-10-11T14:59:59Z"))).toBe("2026-10-11");
    expect(japanToday(new Date("2026-10-11T15:00:00Z"))).toBe("2026-10-12");
  });
});

describe("rating wire presence", () => {
  it("distinguishes an omitted update from explicit zero", () => {
    const absent = create(UpdateEntryRequestSchema, { entryId: "entry-1" });
    const cleared = create(UpdateEntryRequestSchema, { entryId: "entry-1", rating: 0 });
    expect(fromBinary(UpdateEntryRequestSchema, toBinary(UpdateEntryRequestSchema, absent)).rating).toBeUndefined();
    expect(fromBinary(UpdateEntryRequestSchema, toBinary(UpdateEntryRequestSchema, cleared)).rating).toBe(0);
  });
});
