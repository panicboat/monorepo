import { describe, expect, it } from "vitest";
import { toDateKey, formatDayLabel, buildDateRange } from "./dates";

describe("toDateKey", () => {
  it("formats a local date as YYYY-MM-DD", () => {
    expect(toDateKey(new Date(2026, 8, 20))).toBe("2026-09-20");
  });

  it("zero-pads single-digit month and day", () => {
    expect(toDateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatDayLabel", () => {
  it("formats a date key with its Japanese weekday", () => {
    // 2026-09-20 is a Sunday
    expect(formatDayLabel("2026-09-20")).toBe("9/20(日)");
  });
});

describe("buildDateRange", () => {
  it("returns consecutive date keys starting from the given date", () => {
    expect(buildDateRange(new Date(2026, 8, 18), 3)).toEqual([
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
  });
});
