// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ range: [] as string[], calls: [] as string[][], hasPlan: true, laterPlan: false, sheetOpen: null as null | boolean, hiddenByLock: false }));

vi.mock("@/modules/schedule/hooks", () => ({
  useSchedules: (_id: string, fromDate: string, toDate: string) => {
    mocks.range = [fromDate, toDate];
    mocks.calls.push([fromDate, toDate]);
    return {
      schedules: [
        ...(mocks.hasPlan ? [{ profileId: "p-1", workDate: "2026-10-13", startTime: "20:00", endTime: "02:00" }] : []),
        ...(mocks.laterPlan ? [{ profileId: "p-1", workDate: "2026-11-20", startTime: "21:00", endTime: "23:00" }] : []),
      ],
      hiddenByLock: mocks.hiddenByLock,
      loading: false,
      error: undefined,
      refresh: vi.fn(),
    };
  },
}));
vi.mock("./ScheduleBulkSheet", () => ({
  ScheduleBulkSheet: ({ open }: { open: boolean }) => {
    mocks.sheetOpen = open;
    return <div>bulk-sheet:{String(open)}</div>;
  },
}));

const { ScheduleTab } = await import("./ScheduleTab");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T09:00:00"));
  mocks.sheetOpen = null;
  mocks.hasPlan = true;
  mocks.laterPlan = false;
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
  it("shows the owner two weeks of days from today with the planned hours in a card and unplanned days as plain rows", async () => {
    const container = await mount(true);

    expect(mocks.range).toEqual(["2026-10-12", "2026-11-30"]);
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

    expect(mocks.range).toEqual(["2026-10-12", "2026-11-30"]);
    expect(container.querySelectorAll("li")).toHaveLength(1);
    expect(container.textContent).toContain("20:00 〜 02:00");
    expect(container.textContent).not.toContain("未設定");
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(container.textContent).toContain("予定は予約可能枠を保証するものではありません。");
  });

  it("shows a plan after the first two weeks to the owner and to other viewers", async () => {
    mocks.laterPlan = true;

    const owner = await mount(true);
    expect(owner.querySelectorAll("li")).toHaveLength(15);
    expect(owner.textContent).toContain("11/20(金)");

    const viewer = await mount(false);
    expect(viewer.querySelectorAll("li")).toHaveLength(2);
    expect(viewer.textContent).toContain("11/20(金)");
  });

  it("tells other viewers there is no plan when none falls in the range", async () => {
    mocks.hasPlan = false;
    const container = await mount(false);

    expect(container.querySelectorAll("li")).toHaveLength(0);
    expect(container.textContent).toContain("予定はありません");
    expect(container.textContent).not.toContain("予定は予約可能枠を保証するものではありません。");
  });

  it("has no もっと見る button", async () => {
    const container = await mount(false);

    expect(Array.from(container.querySelectorAll("button")).some((b) => b.textContent === "もっと見る")).toBe(false);
    expect(mocks.calls).toEqual([["2026-10-12", "2026-11-30"]]);
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

  it("gives the owner a single button that opens the editor", async () => {
    const container = await mount(true);

    expect(Array.from(container.querySelectorAll("button")).map((b) => b.textContent)).toEqual(["予定を編集"]);
    await act(async () => {
      (container.querySelector("button") as HTMLButtonElement).click();
    });

    expect(mocks.sheetOpen).toBe(true);
  });

  it("gives other viewers no button to open the editor", async () => {
    const container = await mount(false);

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
