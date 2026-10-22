// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleSearchResultView } from "@/modules/schedule/types";
import { toDateKey } from "@/modules/schedule/lib/dates";
import { defaultSearchChoices, type ScheduleSearchChoices } from "@/modules/schedule/lib/searchChoices";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  useSearchSchedules: vi.fn(),
  loadMore: vi.fn(),
  onChoicesChange: vi.fn(),
  state: {} as Record<string, unknown>,
}));

vi.mock("@/modules/discovery", () => ({ useSearchSchedules: mocks.useSearchSchedules }));
vi.mock("./ScheduleSearchCard", () => ({
  ScheduleSearchCard: ({ result }: { result: ScheduleSearchResultView }) => createElement("div", { "data-card": result.profile.profileId }, result.profile.displayName),
}));

const { ScheduleSearchPanel } = await import("./ScheduleSearchPanel");

function resultFor(profileId: string): ScheduleSearchResultView {
  return {
    schedule: { profileId, workDate: "2026-10-23", startTime: "20:00", endTime: "02:00" },
    profile: { profileId, username: profileId, displayName: `name-${profileId}`, avatarUrl: "", isPrivate: false, role: "cast", industry: "" },
    prefecture: "東京都",
    area: "",
    note: "",
  };
}

let container: HTMLElement;
let unmount: () => Promise<void>;
const originalTz = process.env.TZ;

function Harness({ query, initial }: { query: string; initial: ScheduleSearchChoices }) {
  const [choices, setChoices] = useState(initial);
  return createElement(ScheduleSearchPanel, {
    query,
    choices,
    onChoicesChange: (next: ScheduleSearchChoices) => {
      mocks.onChoicesChange(next);
      setChoices(next);
    },
  });
}

async function mount(query = "", choices: Partial<ScheduleSearchChoices> = {}) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  unmount = async () => {
    await act(async () => root.unmount());
    container.remove();
  };
  await act(async () => {
    root.render(createElement(Harness, { query, initial: { ...defaultSearchChoices(), ...choices } }));
  });
}

const lastFilters = () => mocks.useSearchSchedules.mock.calls.at(-1)![0];

function group(name: string): HTMLElement {
  const heading = Array.from(container.querySelectorAll("[id]")).find((el) => el.textContent === name)!;
  return container.querySelector(`[aria-labelledby="${heading.id}"]`) as HTMLElement;
}

const chipsIn = (name: string) => Array.from(group(name).querySelectorAll("button"));
const chip = (name: string, label: string) => chipsIn(name).find((b) => b.textContent === label) as HTMLButtonElement;

function click(el: Element) {
  return act(async () => {
    (el as HTMLElement).click();
  });
}

const selectNamed = (label: string) => container.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement | null;

async function choose(label: string, value: string) {
  const select = selectNamed(label)!;
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  process.env.TZ = "America/Los_Angeles";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-22T20:00:00Z"));
  mocks.loadMore.mockReset();
  mocks.onChoicesChange.mockReset();
  mocks.state = { results: [], hasMore: false, loading: false, error: undefined, loadMore: mocks.loadMore };
  mocks.useSearchSchedules.mockReset().mockImplementation(() => mocks.state);
});

afterEach(async () => {
  await unmount();
  vi.useRealTimers();
  if (originalTz === undefined) delete process.env.TZ;
  else process.env.TZ = originalTz;
});

describe("ScheduleSearchPanel filters", () => {
  it("starts on today in Japan, not on the device's today", async () => {
    expect(toDateKey(new Date())).toBe("2026-10-22");

    await mount();

    expect(lastFilters().date).toBe("2026-10-23");
    expect(chip("出勤日", "今日").getAttribute("aria-pressed")).toBe("true");
  });

  it("starts on today in Japan when the device is already a day ahead of Japan", async () => {
    process.env.TZ = "Pacific/Kiritimati";
    vi.setSystemTime(new Date("2026-10-22T10:30:00Z"));
    expect(toDateKey(new Date())).toBe("2026-10-23");

    await mount();

    expect(lastFilters().date).toBe("2026-10-22");
    expect(chipsIn("出勤日").map((b) => b.textContent).slice(0, 3)).toEqual(["今日", "明日", "10/24(土)"]);
  });

  it("offers 14 date chips from today, labelled 今日 and 明日 and then by date and weekday", async () => {
    await mount();

    const labels = chipsIn("出勤日").map((b) => b.textContent);
    expect(labels).toHaveLength(14);
    expect(labels.slice(0, 3)).toEqual(["今日", "明日", "10/25(日)"]);
    expect(labels.at(-1)).toBe("11/5(木)");
  });

  it("keeps one chip per day when the device zone leaves daylight saving time inside the range", async () => {
    vi.setSystemTime(new Date("2026-10-31T03:00:00Z"));

    await mount();

    const labels = chipsIn("出勤日").map((b) => b.textContent);
    expect(labels.slice(0, 4)).toEqual(["今日", "明日", "11/2(月)", "11/3(火)"]);
    expect(new Set(labels).size).toBe(14);
  });

  it("starts on every area, every start band and the following switch off", async () => {
    await mount();

    expect(lastFilters()).toEqual({ date: "2026-10-23", prefecture: "", area: "", industry: "", timeBand: "", followingOnly: false, query: "" });
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.selectedOptions[0].textContent).toBe("全国");
    expect(Array.from(select.options)).toHaveLength(48);
    expect(chipsIn("勤務時間帯").map((b) => b.textContent)).toEqual(["すべて", "昼（5〜18時）", "夜（18〜21時）", "深夜（21時〜翌5時）"]);
    expect(chip("勤務時間帯", "すべて").getAttribute("aria-pressed")).toBe("true");
    const toggle = container.querySelector('[role="switch"]') as HTMLElement;
    expect(toggle.getAttribute("aria-label")).toBe("フォロー中だけを見る");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  });

  it("passes the date, area, start band and following switch that are chosen", async () => {
    await mount();

    await click(chipsIn("出勤日")[2]);
    expect(lastFilters().date).toBe("2026-10-25");
    expect(chipsIn("出勤日")[2].getAttribute("aria-pressed")).toBe("true");
    expect(chip("出勤日", "今日").getAttribute("aria-pressed")).toBe("false");

    await choose("都道府県", "大阪府");
    expect(lastFilters().prefecture).toBe("大阪府");

    await click(chip("勤務時間帯", "夜（18〜21時）"));
    expect(lastFilters().timeBand).toBe("evening");
    await click(chip("勤務時間帯", "昼（5〜18時）"));
    expect(lastFilters().timeBand).toBe("day");
    await click(chip("勤務時間帯", "深夜（21時〜翌5時）"));
    expect(lastFilters().timeBand).toBe("night");
    await click(chip("勤務時間帯", "すべて"));
    expect(lastFilters().timeBand).toBe("");

    await click(container.querySelector('[role="switch"]')!);
    expect(lastFilters().followingOnly).toBe(true);
    expect(lastFilters()).toEqual({ date: "2026-10-25", prefecture: "大阪府", area: "", industry: "", timeBand: "", followingOnly: true, query: "" });

    await choose("都道府県", "");
    expect(lastFilters().prefecture).toBe("");
  });

  it("offers the areas of the chosen prefecture and clears the area when the prefecture changes", async () => {
    await mount();
    expect(selectNamed("エリア")).toBeNull();

    await choose("都道府県", "東京都");
    const areas = Array.from(selectNamed("エリア")!.options, (option) => option.textContent);
    expect(areas[0]).toBe("東京都のすべて");
    expect(areas).toContain("新宿");
    expect(areas).not.toContain("梅田");

    await choose("エリア", "新宿");
    expect(lastFilters()).toMatchObject({ prefecture: "東京都", area: "新宿" });

    await choose("都道府県", "大阪府");
    expect(lastFilters()).toMatchObject({ prefecture: "大阪府", area: "" });
    expect(selectNamed("エリア")!.value).toBe("");
  });

  it("passes the industry that is chosen", async () => {
    await mount();
    const industries = Array.from(selectNamed("業種")!.options, (option) => option.textContent);
    expect(industries.slice(0, 3)).toEqual(["すべて", "ソープ", "デリヘル"]);

    await choose("業種", "ソープ");

    expect(lastFilters().industry).toBe("ソープ");
  });

  it("starts from the choices it is given", async () => {
    await mount("", { date: "2026-10-25", prefecture: "東京都", area: "", industry: "", timeBand: "night", followingOnly: true });

    expect(lastFilters()).toEqual({ date: "2026-10-25", prefecture: "東京都", area: "", industry: "", timeBand: "night", followingOnly: true, query: "" });
    expect(chipsIn("出勤日")[2].getAttribute("aria-pressed")).toBe("true");
    expect((container.querySelector("select") as HTMLSelectElement).value).toBe("東京都");
    expect(chip("勤務時間帯", "深夜（21時〜翌5時）").getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector('[role="switch"]')!.getAttribute("aria-checked")).toBe("true");
  });

  it("reports the whole set of choices each time one changes", async () => {
    await mount();

    await click(chipsIn("出勤日")[1]);
    expect(mocks.onChoicesChange).toHaveBeenLastCalledWith({ date: "2026-10-24", prefecture: "", area: "", industry: "", timeBand: "", followingOnly: false });

    await choose("都道府県", "大阪府");
    expect(mocks.onChoicesChange).toHaveBeenLastCalledWith({ date: "2026-10-24", prefecture: "大阪府", area: "", industry: "", timeBand: "", followingOnly: false });

    await click(chip("勤務時間帯", "夜（18〜21時）"));
    expect(mocks.onChoicesChange).toHaveBeenLastCalledWith({ date: "2026-10-24", prefecture: "大阪府", area: "", industry: "", timeBand: "evening", followingOnly: false });

    await click(container.querySelector('[role="switch"]')!);
    expect(mocks.onChoicesChange).toHaveBeenLastCalledWith({ date: "2026-10-24", prefecture: "大阪府", area: "", industry: "", timeBand: "evening", followingOnly: true });
    expect(mocks.onChoicesChange).toHaveBeenCalledTimes(4);
  });

  it("passes the search box text as the name filter, empty text included", async () => {
    await mount("すず");

    expect(lastFilters().query).toBe("すず");
    await unmount();

    await mount("");
    expect(lastFilters().query).toBe("");
  });
});

describe("ScheduleSearchPanel results", () => {
  it("heads the list with the chosen date and shows each result as a card, with the note below", async () => {
    mocks.state = { ...mocks.state, results: [resultFor("a"), resultFor("b")] };
    await mount();

    expect(container.querySelector("h2")?.textContent).toBe("10/23（金）の出勤予定");
    expect(Array.from(container.querySelectorAll("[data-card]")).map((c) => c.getAttribute("data-card"))).toEqual(["a", "b"]);
    expect(container.textContent).toContain("キャストが公開した出勤予定です。予約の空きや受付可否を保証するものではありません。");
    expect(container.textContent).not.toContain("この日の出勤予定はまだありません");

    await click(chipsIn("出勤日")[1]);
    expect(container.querySelector("h2")?.textContent).toBe("10/24（土）の出勤予定");
  });

  it("shows no count in the heading", async () => {
    mocks.state = { ...mocks.state, results: [resultFor("a"), resultFor("b")] };
    await mount();

    expect(container.querySelector("h2")?.textContent).not.toMatch(/\d+\s*件/);
  });

  it("says there are no schedules yet when the list is empty", async () => {
    await mount();

    expect(container.textContent).toContain("この日の出勤予定はまだありません");
    expect(container.querySelector("h2")?.textContent).toBe("10/23（金）の出勤予定");
  });

  it("says no schedule matches when an empty list is narrowed by the area, the start band, the following switch or a name", async () => {
    const NARROWED = "条件に合う出勤予定はありません";
    const EMPTY_DAY = "この日の出勤予定はまだありません";

    await mount();
    await choose("都道府県", "大阪府");
    expect(container.textContent).toContain(NARROWED);
    expect(container.textContent).not.toContain(EMPTY_DAY);
    await choose("都道府県", "");
    expect(container.textContent).toContain(EMPTY_DAY);
    expect(container.textContent).not.toContain(NARROWED);

    await click(chip("勤務時間帯", "深夜（21時〜翌5時）"));
    expect(container.textContent).toContain(NARROWED);
    await click(chip("勤務時間帯", "すべて"));
    expect(container.textContent).toContain(EMPTY_DAY);

    await click(container.querySelector('[role="switch"]')!);
    expect(container.textContent).toContain(NARROWED);
    await click(container.querySelector('[role="switch"]')!);
    expect(container.textContent).toContain(EMPTY_DAY);
    await unmount();

    await mount("すず");
    expect(container.textContent).toContain(NARROWED);
    expect(container.textContent).not.toContain(EMPTY_DAY);
  });

  it("keeps the plain empty text when only the date is changed or the name is blank", async () => {
    await mount("  ");

    await click(chipsIn("出勤日")[3]);

    expect(container.textContent).toContain("この日の出勤予定はまだありません");
    expect(container.textContent).not.toContain("条件に合う出勤予定はありません");
  });

  it("shows neither empty text while loading or after an error, narrowed or not", async () => {
    mocks.state = { ...mocks.state, loading: true };
    await mount("すず");
    expect(container.textContent).not.toContain("条件に合う出勤予定はありません");
    expect(container.textContent).toContain("検索中…");
    await unmount();

    mocks.state = { ...mocks.state, loading: false, error: new Error("boom") };
    await mount("すず");
    expect(container.textContent).not.toContain("条件に合う出勤予定はありません");
    expect(container.textContent).toContain("読み込みに失敗しました");
  });

  it("does not say the list is empty while it is loading, and says it could not load on an error", async () => {
    mocks.state = { ...mocks.state, loading: true };
    await mount();
    expect(container.textContent).not.toContain("この日の出勤予定はまだありません");
    expect(container.textContent).toContain("検索中…");
    await unmount();

    mocks.state = { ...mocks.state, loading: false, error: new Error("boom") };
    await mount();
    expect(container.textContent).not.toContain("この日の出勤予定はまだありません");
    expect(container.textContent).toContain("読み込みに失敗しました");
  });

  it("loads the next page from もっと見る only while there is one", async () => {
    mocks.state = { ...mocks.state, results: [resultFor("a")], hasMore: true };
    await mount();

    const more = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "もっと見る")!;
    await click(more);
    expect(mocks.loadMore).toHaveBeenCalledTimes(1);
    await unmount();

    mocks.state = { ...mocks.state, hasMore: false };
    await mount();
    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent === "もっと見る")).toBe(false);
  });
});
