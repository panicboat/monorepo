import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSearchChoices, parseSearchChoices, searchDays, writeSearchChoices } from "./searchChoices";

const query = (search: string) => new URLSearchParams(search);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T20:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("searchDays", () => {
  it("lists 14 days starting from today in Japan", () => {
    const days = searchDays();

    expect(days).toHaveLength(14);
    expect(days[0]).toBe("2026-10-23");
    expect(days.at(-1)).toBe("2026-11-05");
  });
});

describe("defaultSearchChoices", () => {
  it("is today in Japan, every area, every industry, every start band and the following switch off", () => {
    expect(defaultSearchChoices()).toEqual({ date: "2026-10-23", prefecture: "", area: "", industry: "", timeBand: "", followingOnly: false });
  });
});

describe("parseSearchChoices", () => {
  it("reads the date, prefecture, area, industry, start band and following switch", () => {
    const params = query(
      `date=2026-10-24&prefecture=${encodeURIComponent("東京都")}&area=${encodeURIComponent("新宿")}&industry=${encodeURIComponent("ソープ")}&timeBand=night&following=1`
    );

    expect(parseSearchChoices(params)).toEqual({
      date: "2026-10-24",
      prefecture: "東京都",
      area: "新宿",
      industry: "ソープ",
      timeBand: "night",
      followingOnly: true,
    });
  });

  it("accepts every start band", () => {
    for (const band of ["day", "evening", "night"]) {
      expect(parseSearchChoices(query(`timeBand=${band}`)).timeBand).toBe(band);
    }
  });

  it("uses the defaults when nothing is given", () => {
    expect(parseSearchChoices(query(""))).toEqual(defaultSearchChoices());
    expect(parseSearchChoices(null)).toEqual(defaultSearchChoices());
  });

  it("falls back to today for a date outside the 14 days or one that is not a date", () => {
    for (const date of ["2026-10-22", "2026-11-06", "2026-13-01", "tomorrow", ""]) {
      expect(parseSearchChoices(query(`date=${date}`)).date).toBe("2026-10-23");
    }
    expect(parseSearchChoices(query("date=2026-11-05")).date).toBe("2026-11-05");
  });

  it("falls back to every area for an unknown prefecture", () => {
    expect(parseSearchChoices(query("prefecture=Tokyo")).prefecture).toBe("");
  });

  it("falls back to every area for an area outside the prefecture or without a prefecture", () => {
    expect(parseSearchChoices(query(`prefecture=${encodeURIComponent("大阪府")}&area=${encodeURIComponent("新宿")}`)).area).toBe("");
    expect(parseSearchChoices(query(`area=${encodeURIComponent("新宿")}`)).area).toBe("");
  });

  it("falls back to every industry for an unknown industry", () => {
    expect(parseSearchChoices(query("industry=soap")).industry).toBe("");
  });

  it("falls back to every start band for an unknown band", () => {
    expect(parseSearchChoices(query("timeBand=NIGHT")).timeBand).toBe("");
    expect(parseSearchChoices(query("timeBand=morning")).timeBand).toBe("");
  });

  it("turns the following switch on only for 1", () => {
    expect(parseSearchChoices(query("following=1")).followingOnly).toBe(true);
    for (const value of ["0", "true", ""]) {
      expect(parseSearchChoices(query(`following=${value}`)).followingOnly).toBe(false);
    }
  });
});

describe("writeSearchChoices", () => {
  it("writes nothing for the defaults", () => {
    const params = query("");

    writeSearchChoices(params, defaultSearchChoices());

    expect(params.toString()).toBe("");
  });

  it("writes each choice that differs from the default, with 1 for the following switch", () => {
    const params = query("");

    writeSearchChoices(params, { date: "2026-10-24", prefecture: "東京都", area: "新宿", industry: "ソープ", timeBand: "night", followingOnly: true });

    expect(Object.fromEntries(params)).toEqual({
      date: "2026-10-24",
      prefecture: "東京都",
      area: "新宿",
      industry: "ソープ",
      timeBand: "night",
      following: "1",
    });
  });

  it("round-trips through parseSearchChoices", () => {
    const choices = { date: "2026-10-30", prefecture: "大阪府", area: "梅田", industry: "デリヘル", timeBand: "evening" as const, followingOnly: true };
    const params = query("");

    writeSearchChoices(params, choices);

    expect(parseSearchChoices(new URLSearchParams(params.toString()))).toEqual(choices);
  });
});
