import { describe, expect, it } from "vitest";
import { toDateKey, formatDayLabel, formatScheduleDay, buildDateRange, buildDateRangeThroughNextMonth, formatMonthDay, crossesMidnight } from "./dates";

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
    expect(formatDayLabel("2026-09-20")).toBe("9/20(日)");
  });
});

describe("formatScheduleDay", () => {
  it("formats a date key with the weekday in full-width parentheses", () => {
    expect(formatScheduleDay("2026-10-24")).toBe("10/24（土）");
    expect(formatScheduleDay("2026-01-05")).toBe("1/5（月）");
  });
});

describe("buildDateRangeThroughNextMonth", () => {
  it("runs from the start date through the last day of the next month", () => {
    const days = buildDateRangeThroughNextMonth(new Date(2026, 9, 12, 9, 0));
    expect(days[0]).toBe("2026-10-12");
    expect(days[days.length - 1]).toBe("2026-11-30");
    expect(days).toHaveLength(50);
  });

  it("crosses the year and keeps the short month when the start date is late in the month", () => {
    expect(buildDateRangeThroughNextMonth(new Date(2026, 11, 31)).at(-1)).toBe("2027-01-31");
    expect(buildDateRangeThroughNextMonth(new Date(2027, 0, 31)).at(-1)).toBe("2027-02-28");
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

describe("formatMonthDay", () => {
  it("shows a date key as month/day without leading zeros", () => {
    expect(formatMonthDay("2026-10-13")).toBe("10/13");
    expect(formatMonthDay("2026-01-05")).toBe("1/5");
  });
});

describe("crossesMidnight", () => {
  it("is true when the end is at or before the start", () => {
    expect(crossesMidnight("20:00", "02:00")).toBe(true);
    expect(crossesMidnight("23:30", "04:00")).toBe(true);
    expect(crossesMidnight("20:00", "20:00")).toBe(true);
  });

  it("is true when the start is before 05:00", () => {
    expect(crossesMidnight("01:00", "05:00")).toBe(true);
    expect(crossesMidnight("03:00", "08:00")).toBe(true);
    expect(crossesMidnight("04:59", "23:00")).toBe(true);
    expect(crossesMidnight("00:00", "12:00")).toBe(true);
  });

  it("is false for a schedule that starts at or after 05:00 and ends later the same day", () => {
    expect(crossesMidnight("05:00", "08:00")).toBe(false);
    expect(crossesMidnight("10:00", "18:00")).toBe(false);
    expect(crossesMidnight("18:00", "23:00")).toBe(false);
  });
});
