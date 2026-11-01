import { describe, expect, it } from "vitest";
import { isQuotable } from "./quotable";

const NOW = new Date("2026-10-10T12:00:00Z");
const live = { visibility: "public" as const, publishedAt: "2026-10-01T00:00:00Z", expiresAt: "" };

describe("isQuotable", () => {
  it("is quotable only when public and live", () => {
    expect(isQuotable(live, NOW)).toBe(true);
    expect(isQuotable({ ...live, publishedAt: "", expiresAt: "2026-10-11T00:00:00Z" }, NOW)).toBe(true);
  });

  it("is not quotable when followers-only, scheduled, or expired", () => {
    expect(isQuotable({ ...live, visibility: "private" }, NOW)).toBe(false);
    expect(isQuotable({ ...live, publishedAt: "2026-10-11T00:00:00Z" }, NOW)).toBe(false);
    expect(isQuotable({ ...live, expiresAt: "2026-10-10T00:00:00Z" }, NOW)).toBe(false);
  });
});
