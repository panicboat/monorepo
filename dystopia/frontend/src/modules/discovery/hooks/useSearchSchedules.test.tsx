// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleSearchResultView } from "@/modules/schedule/types";
import type { ScheduleSearchFilters } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), profileId: "viewer-1" as string | null }));

vi.mock("@/lib/swr", () => ({ fetcher: mocks.fetcher }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string | null }) => unknown) => selector({ activeProfileId: mocks.profileId }),
}));

const { useSearchSchedules } = await import("./useSearchSchedules");

const BASE: ScheduleSearchFilters = { date: "2026-10-22", prefecture: "", area: "", industry: "", timeBand: "", followingOnly: false, query: "" };

function resultFor(profileId: string): ScheduleSearchResultView {
  return {
    schedule: { profileId, workDate: "2026-10-22", startTime: "20:00", endTime: "02:00" },
    profile: { profileId, username: profileId, displayName: profileId, avatarUrl: "", isPrivate: false, role: "cast", industry: "" },
    prefecture: "東京都",
    area: "",
    note: "",
  };
}

function params(url: string) {
  return Object.fromEntries(new URL(url, "http://localhost").searchParams);
}

let current: ReturnType<typeof useSearchSchedules>;
let seen: string[][];
let root: Root;
let container: HTMLElement;

function Probe({ filters }: { filters: ScheduleSearchFilters }) {
  current = useSearchSchedules(filters);
  seen.push(current.results.map((r) => r.profile.profileId));
  return null;
}

async function show(filters: ScheduleSearchFilters) {
  await act(async () => {
    root.render(createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(Probe, { filters })));
  });
}

const requested = () => mocks.fetcher.mock.calls.map(([url]) => url as string);

beforeEach(() => {
  seen = [];
  mocks.profileId = "viewer-1";
  mocks.fetcher.mockReset().mockImplementation(async (url: string) => {
    const query = params(url);
    if (query.cursor === "page-2") return { results: [resultFor("cast-3")], nextCursor: "", hasMore: false };
    if (query.timeBand === "night") return { results: [resultFor("night-1")], nextCursor: "", hasMore: false };
    return { results: [resultFor("cast-1"), resultFor("cast-2")], nextCursor: "page-2", hasMore: true };
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  vi.useRealTimers();
  await act(async () => root.unmount());
  container.remove();
});

describe("useSearchSchedules", () => {
  it("requests the first page for the date with the prefecture, area, industry, band, following switch and name", async () => {
    await show({ date: "2026-10-23", prefecture: "東京都", area: "新宿", industry: "ソープ", timeBand: "evening", followingOnly: true, query: " すず " });

    expect(requested()).toHaveLength(1);
    expect(requested()[0].startsWith("/api/discovery/schedules?")).toBe(true);
    expect(params(requested()[0])).toEqual({
      date: "2026-10-23",
      prefecture: "東京都",
      area: "新宿",
      industry: "ソープ",
      timeBand: "evening",
      followingOnly: "true",
      q: "すず",
    });
  });

  it("requests the list for the date alone when no other filter is set, even with an empty name", async () => {
    await show(BASE);

    expect(params(requested()[0])).toEqual({ date: "2026-10-22" });
    expect(current.results.map((r) => r.profile.profileId)).toEqual(["cast-1", "cast-2"]);
    expect(current.hasMore).toBe(true);
  });

  it("requests nothing without an active profile", async () => {
    mocks.profileId = null;

    await show(BASE);

    expect(requested()).toEqual([]);
  });

  it("appends the next page by its cursor", async () => {
    await show(BASE);

    await act(async () => current.loadMore());

    expect(requested().map(params).filter((query) => query.cursor)).toEqual([{ date: "2026-10-22", cursor: "page-2" }]);
    expect(current.results.map((r) => r.profile.profileId)).toEqual(["cast-1", "cast-2", "cast-3"]);
    expect(current.hasMore).toBe(false);
  });

  it("restarts from the first page and never shows the old pages with the new results when a filter changes", async () => {
    await show(BASE);
    await act(async () => current.loadMore());
    expect(current.results).toHaveLength(3);
    seen = [];

    await show({ ...BASE, timeBand: "night" });

    expect(params(requested().at(-1)!)).toEqual({ date: "2026-10-22", timeBand: "night" });
    expect(current.results.map((r) => r.profile.profileId)).toEqual(["night-1"]);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((ids) => ids.every((id) => id === "night-1"))).toBe(true);
  });

  it("loads the next page of the new filter after a restart, not a page of the old one", async () => {
    await show(BASE);
    await act(async () => current.loadMore());
    await show({ ...BASE, prefecture: "大阪府" });

    await act(async () => current.loadMore());

    expect(params(requested().at(-1)!)).toEqual({ date: "2026-10-22", prefecture: "大阪府", cursor: "page-2" });
    expect(current.results.map((r) => r.profile.profileId)).toEqual(["cast-1", "cast-2", "cast-3"]);
  });

  it("shows only the first page again when the filters return to a set that was loaded further", async () => {
    await show(BASE);
    await act(async () => current.loadMore());
    expect(current.results).toHaveLength(3);
    await show({ ...BASE, timeBand: "night" });
    const before = requested().length;

    await show(BASE);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(current.results.map((r) => r.profile.profileId)).toEqual(["cast-1", "cast-2"]);
    expect(current.hasMore).toBe(true);
    expect(requested().slice(before).map(params).filter((query) => query.cursor)).toEqual([]);

    await act(async () => current.loadMore());
    expect(current.results.map((r) => r.profile.profileId)).toEqual(["cast-1", "cast-2", "cast-3"]);
  });

  it("waits for typing to pause before it requests a new name", async () => {
    vi.useFakeTimers();
    await show(BASE);
    const before = requested().length;

    await show({ ...BASE, query: "す" });
    await show({ ...BASE, query: "すず" });
    expect(requested()).toHaveLength(before);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(requested()).toHaveLength(before + 1);
    expect(params(requested().at(-1)!)).toEqual({ date: "2026-10-22", q: "すず" });
  });
});
