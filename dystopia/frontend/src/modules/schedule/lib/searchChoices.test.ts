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

describe("defaultSearchChoices with the acting profile's main area", () => {
  it("starts from the prefecture and the area of the profile", () => {
    expect(defaultSearchChoices({ prefecture: "東京都", area: "新宿" })).toMatchObject({ prefecture: "東京都", area: "新宿" });
  });

  it("drops an area that does not belong to the prefecture and an unknown prefecture", () => {
    expect(defaultSearchChoices({ prefecture: "東京都", area: "梅田" })).toMatchObject({ prefecture: "東京都", area: "" });
    expect(defaultSearchChoices({ prefecture: "Tokyo", area: "新宿" })).toMatchObject({ prefecture: "", area: "" });
  });
});

describe("parseSearchChoices with the acting profile's main area", () => {
  const home = { prefecture: "東京都", area: "新宿" };

  it("uses the profile's area when the URL has no prefecture", () => {
    expect(parseSearchChoices(query(""), home)).toMatchObject({ prefecture: "東京都", area: "新宿" });
    expect(parseSearchChoices(null, home)).toMatchObject({ prefecture: "東京都", area: "新宿" });
  });

  it("reads an empty prefecture as 全国 chosen over the profile's area", () => {
    expect(parseSearchChoices(query("prefecture="), home)).toMatchObject({ prefecture: "", area: "" });
  });

  it("does not carry the profile's area into another prefecture or a prefecture without an area", () => {
    expect(parseSearchChoices(query(`prefecture=${encodeURIComponent("大阪府")}`), home)).toMatchObject({ prefecture: "大阪府", area: "" });
    expect(parseSearchChoices(query(`prefecture=${encodeURIComponent("東京都")}`), home)).toMatchObject({ prefecture: "東京都", area: "" });
  });

  it("falls back to the profile's area for an unknown prefecture", () => {
    expect(parseSearchChoices(query(`prefecture=Narnia&area=${encodeURIComponent("梅田")}`), home)).toMatchObject({ prefecture: "東京都", area: "新宿" });
  });
});

describe("writeSearchChoices with the acting profile's main area", () => {
  const home = { prefecture: "東京都", area: "新宿" };
  const written = (choices: Partial<ReturnType<typeof defaultSearchChoices>>) => {
    const params = query("");
    writeSearchChoices(params, { ...defaultSearchChoices(home), ...choices }, home);
    return params.toString();
  };

  it("writes nothing for the profile's area and writes every other choice of area so it reads back the same", () => {
    expect(written({})).toBe("");
    expect(written({ prefecture: "", area: "" })).toBe("prefecture=");
    expect(written({ area: "" })).toBe(`prefecture=${encodeURIComponent("東京都")}`);
    expect(written({ area: "池袋" })).toBe(`prefecture=${encodeURIComponent("東京都")}&area=${encodeURIComponent("池袋")}`);

    for (const choices of [{}, { prefecture: "", area: "" }, { area: "" }, { area: "池袋" }, { prefecture: "大阪府", area: "梅田" }]) {
      const params = query("");
      const chosen = { ...defaultSearchChoices(home), ...choices };
      writeSearchChoices(params, chosen, home);
      expect(parseSearchChoices(new URLSearchParams(params.toString()), home)).toEqual(chosen);
    }
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
