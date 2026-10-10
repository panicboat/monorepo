import { describe, expect, it } from "vitest";
import { isEditedAfterCreation } from "./date";

describe("isEditedAfterCreation", () => {
  it("is true when the update time is later than the creation time", () => {
    expect(isEditedAfterCreation("2026-10-10T00:00:00.000Z", "2026-10-10T00:05:00.000Z")).toBe(true);
  });

  it("is false when both times are the same", () => {
    expect(isEditedAfterCreation("2026-10-10T00:00:00.000Z", "2026-10-10T00:00:00.000Z")).toBe(false);
  });

  it("is false when either time is missing", () => {
    expect(isEditedAfterCreation("", "2026-10-10T00:05:00.000Z")).toBe(false);
    expect(isEditedAfterCreation("2026-10-10T00:00:00.000Z", "")).toBe(false);
  });
});
