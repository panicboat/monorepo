import { describe, expect, it } from "vitest";
import { KARTE_OUTCOMES, KARTE_STAGES, KARTE_TAGS, MAX_NOTE_LENGTH, isNoteRequired, outcomeLabel, stageLabel, tagLabel } from "./catalog";

const codes = (choices: { code: string }[]) => choices.map((choice) => choice.code);

describe("karte catalog", () => {
  it("lists the stages in order", () => {
    expect(codes(KARTE_STAGES)).toEqual(["reservation", "service", "aftercare"]);
  });

  it("lists the outcomes of each stage as the spec does", () => {
    expect(codes(KARTE_OUTCOMES.reservation)).toEqual(["inquiry_only", "booked", "cancelled_with_notice", "no_show", "other"]);
    expect(codes(KARTE_OUTCOMES.service)).toEqual(["completed", "completed_with_issues", "ended_early", "other"]);
    expect(codes(KARTE_OUTCOMES.aftercare)).toEqual([
      "closed_without_issues",
      "next_booking_inquiry",
      "inquiry_handled",
      "trouble_occurred",
      "trouble_resolved",
      "other",
    ]);
  });

  it("lists the tags of each stage as the spec does", () => {
    expect(codes(KARTE_TAGS.reservation)).toEqual([
      "smooth_contact",
      "contact_problem",
      "condition_mismatch",
      "rescheduled",
      "advance_notice",
      "unagreed_request",
    ]);
    expect(codes(KARTE_TAGS.service)).toEqual(["punctual", "late", "payment_ok", "payment_trouble", "smooth_communication", "excessive_request"]);
    expect(codes(KARTE_TAGS.aftercare)).toEqual([
      "polite_contact",
      "excessive_contact",
      "personal_contact_request",
      "condition_change_request",
      "resolved",
    ]);
  });

  it("requires a note only for the serious outcomes", () => {
    expect(isNoteRequired("reservation", "no_show")).toBe(true);
    expect(isNoteRequired("service", "ended_early")).toBe(true);
    expect(isNoteRequired("aftercare", "trouble_occurred")).toBe(true);
    expect(isNoteRequired("reservation", "booked")).toBe(false);
    expect(MAX_NOTE_LENGTH).toBe(500);
  });

  it("names codes in Japanese and falls back to the code for an unknown one", () => {
    expect(stageLabel("aftercare")).toBe("接客後");
    expect(outcomeLabel("reservation", "no_show")).toBe("無断キャンセル・来店なし");
    expect(tagLabel("service", "late")).toBe("遅刻あり");
    expect(outcomeLabel("service", "retired_code")).toBe("retired_code");
  });
});
