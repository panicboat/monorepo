import { describe, expect, it } from "vitest";
import { REVIEW_OUTCOMES, REVIEW_STAGES, REVIEW_TAGS, isNoteRequired, outcomeLabel, stageLabel, tagLabel } from "./catalog";

describe("review catalog", () => {
  it("names the stages from the guest's point of view", () => {
    expect(REVIEW_STAGES.map((stage) => stage.label)).toEqual(["予約・問い合わせ", "利用", "利用後"]);
  });

  it("holds the codes of the spec for each stage", () => {
    expect(REVIEW_OUTCOMES.reservation.map((c) => c.code)).toEqual(["inquiry_only", "booked", "cancelled_by_cast", "cast_no_show", "other"]);
    expect(REVIEW_OUTCOMES.service.map((c) => c.code)).toEqual(["satisfied", "completed_with_issues", "ended_early", "other"]);
    expect(REVIEW_OUTCOMES.aftercare.map((c) => c.code)).toEqual(["closed_without_issues", "next_booking_inquiry", "inquiry_handled", "trouble_occurred", "trouble_resolved", "other"]);
    expect(REVIEW_TAGS.reservation.map((c) => c.code)).toEqual(["quick_reply", "slow_reply", "clear_conditions", "condition_mismatch", "rescheduled", "polite_response"]);
    expect(REVIEW_TAGS.service.map((c) => c.code)).toEqual(["punctual", "late", "as_pictured", "not_as_pictured", "attentive", "unagreed_charge"]);
    expect(REVIEW_TAGS.aftercare.map((c) => c.code)).toEqual(["polite_contact", "excessive_contact", "condition_change_request", "resolved"]);
  });

  it("requires a note only for the serious outcomes", () => {
    expect(isNoteRequired("reservation", "cast_no_show")).toBe(true);
    expect(isNoteRequired("service", "ended_early")).toBe(true);
    expect(isNoteRequired("aftercare", "trouble_occurred")).toBe(true);
    expect(isNoteRequired("service", "satisfied")).toBe(false);
  });

  it("labels codes and falls back to the code for an unknown one", () => {
    expect(stageLabel("service")).toBe("利用");
    expect(outcomeLabel("service", "satisfied")).toBe("満足して終了");
    expect(tagLabel("service", "late")).toBe("遅刻あり");
    expect(outcomeLabel("service", "gone")).toBe("gone");
  });
});
