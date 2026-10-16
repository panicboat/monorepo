// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ range: [] as string[], sheetOpen: null as null | boolean }));

vi.mock("@/modules/schedule/hooks", () => ({
  useSchedules: (_id: string, fromDate: string, toDate: string) => {
    mocks.range = [fromDate, toDate];
    return {
      schedules: [{ profileId: "p-1", workDate: "2026-10-13", startTime: "20:00", endTime: "02:00" }],
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
  it("shows a week from today with the planned hours and a note", async () => {
    const container = await mount(false);

    expect(mocks.range).toEqual(["2026-10-12", "2026-10-18"]);
    expect(container.querySelectorAll("li")).toHaveLength(7);
    expect(container.textContent).toContain("10/13");
    expect(container.textContent).toContain("20:00");
    expect(container.textContent).toContain("〜02:00");
    expect(container.textContent).toContain("未設定");
    expect(container.textContent).toContain("出勤情報は予約可能枠を保証するものではありません。");
    expect(container.textContent).not.toContain("まとめて編集");
  });

  it("lets the owner open the bulk sheet", async () => {
    const container = await mount(true);

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "まとめて編集") as HTMLButtonElement).click();
    });

    expect(mocks.sheetOpen).toBe(true);
  });
});
