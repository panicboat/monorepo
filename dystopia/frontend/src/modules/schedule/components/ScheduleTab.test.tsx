// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ range: [] as string[], calls: [] as string[][], hasPlan: true, sheetTodayOnly: null as null | boolean, sheetOpen: null as null | boolean, hiddenByLock: false }));

vi.mock("@/modules/schedule/hooks", () => ({
  useSchedules: (_id: string, fromDate: string, toDate: string) => {
    mocks.range = [fromDate, toDate];
    mocks.calls.push([fromDate, toDate]);
    return {
      schedules: mocks.hasPlan ? [{ profileId: "p-1", workDate: "2026-10-13", startTime: "20:00", endTime: "02:00" }] : [],
      hiddenByLock: mocks.hiddenByLock,
      loading: false,
      error: undefined,
      refresh: vi.fn(),
    };
  },
}));
vi.mock("./ScheduleBulkSheet", () => ({
  ScheduleBulkSheet: ({ open, todayOnly }: { open: boolean; todayOnly: boolean }) => {
    mocks.sheetOpen = open;
    mocks.sheetTodayOnly = todayOnly;
    return <div>bulk-sheet:{String(open)}</div>;
  },
}));

const { ScheduleTab } = await import("./ScheduleTab");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T09:00:00"));
  mocks.sheetOpen = null;
  mocks.sheetTodayOnly = null;
  mocks.hasPlan = true;
  mocks.calls = [];
  mocks.hiddenByLock = false;
});

afterEach(() => {
  vi.useRealTimers();
});

async function mount(isOwner: boolean) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(ScheduleTab, { profileId: "p-1", isOwner }));
  });
  return container;
}

describe("ScheduleTab", () => {
  it("shows the owner two weeks from today with the planned hours in a card and unplanned days as plain rows", async () => {
    const container = await mount(true);

    expect(mocks.range).toEqual(["2026-10-12", "2026-10-25"]);
    expect(container.querySelectorAll("li")).toHaveLength(14);
    expect(container.textContent).toContain("予定");
    expect(container.textContent).not.toContain("出勤");
    const planned = Array.from(container.querySelectorAll("li")).find((li) => li.textContent?.includes("10/13(火)")) as HTMLElement;
    expect(planned.textContent).toContain("20:00 〜 02:00");
    expect(planned.querySelector("p")?.textContent).toBe("20:00 〜 02:00");
    const unplanned = Array.from(container.querySelectorAll("li")).find((li) => li.textContent?.includes("10/12(月)")) as HTMLElement;
    expect(unplanned.textContent).toContain("未設定");
    expect(unplanned.querySelector("p")).toBeNull();
    expect(container.textContent).toContain("予定は予約可能枠を保証するものではありません。");
    expect(container.textContent).not.toContain("予定あり");
  });

  it("shows other viewers only the days with a plan and no edit buttons", async () => {
    const container = await mount(false);

    expect(mocks.range).toEqual(["2026-10-12", "2026-10-25"]);
    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(container.textContent).toContain("20:00 〜 02:00");
    expect(container.textContent).not.toContain("未設定");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.textContent).toContain("予定は予約可能枠を保証するものではありません。");
  });

  it("tells other viewers there is no plan when none falls in the two weeks", async () => {
    mocks.hasPlan = false;
    const container = await mount(false);

    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).toContain("予定はありません");
    expect(container.textContent).not.toContain("予定は予約可能枠を保証するものではありません。");
  });

  it("lets the owner open the sheet for today only", async () => {
    const container = await mount(true);

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "今日の予定を入れる") as HTMLButtonElement).click();
    });

    expect(mocks.sheetOpen).toBe(true);
    expect(mocks.sheetTodayOnly).toBe(true);
  });

  it("has no もっと見る button", async () => {
    const container = await mount(false);

    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent === "もっと見る")).toBe(false);
    expect(mocks.calls).toEqual([["2026-10-12", "2026-10-25"]]);
  });

  it("shows the notice instead of the days and the footnote when hidden by lock", async () => {
    mocks.hiddenByLock = true;
    const container = await mount(false);

    expect(container.textContent).toContain("予定");
    expect(container.textContent).toContain("フォローすると見られます");
    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).not.toContain("未設定");
    expect(container.textContent).not.toContain("予定は予約可能枠を保証するものではありません。");
  });

  it("lets the owner open the bulk sheet", async () => {
    const container = await mount(true);

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "まとめて編集") as HTMLButtonElement).click();
    });

    expect(mocks.sheetOpen).toBe(true);
    expect(mocks.sheetTodayOnly).toBe(false);
  });
});
