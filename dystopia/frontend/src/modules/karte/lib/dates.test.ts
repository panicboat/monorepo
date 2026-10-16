import { describe, expect, it } from "vitest";
import { formatMonthDay, todayInJapan } from "./dates";

describe("todayInJapan", () => {
  it("returns the calendar date in Japan as YYYY-MM-DD", () => {
    expect(todayInJapan(new Date("2026-10-15T14:59:59Z"))).toBe("2026-10-15");
    expect(todayInJapan(new Date("2026-10-15T15:00:00Z"))).toBe("2026-10-16");
  });
});

describe("formatMonthDay", () => {
  it("shows a date as month/day without leading zeros", () => {
    expect(formatMonthDay("2026-10-04")).toBe("10/4");
    expect(formatMonthDay("2026-01-15")).toBe("1/15");
  });
});
