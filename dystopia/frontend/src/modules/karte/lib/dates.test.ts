import { describe, expect, it } from "vitest";
import { todayInJapan } from "./dates";

describe("todayInJapan", () => {
  it("returns the calendar date in Japan as YYYY-MM-DD", () => {
    expect(todayInJapan(new Date("2026-10-15T14:59:59Z"))).toBe("2026-10-15");
    expect(todayInJapan(new Date("2026-10-15T15:00:00Z"))).toBe("2026-10-16");
  });
});
