// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  schedules: [] as { profileId: string; workDate: string; startTime: string; endTime: string }[],
}));

vi.mock("@/modules/schedule/hooks", () => ({
  useSchedules: () => ({ schedules: mocks.schedules, loading: false, error: undefined, refresh: vi.fn() }),
}));

const { WeeklyScheduleSummary } = await import("./WeeklyScheduleSummary");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T09:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function mount(onShowMore = vi.fn()) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(WeeklyScheduleSummary, { profileId: "p-1", onShowMore }));
  });
  return { container, onShowMore };
}

describe("WeeklyScheduleSummary", () => {
  it("lists this week's shifts in date order and shows more on request", async () => {
    mocks.schedules = [
      { profileId: "p-1", workDate: "2026-10-15", startTime: "19:00", endTime: "01:00" },
      { profileId: "p-1", workDate: "2026-10-13", startTime: "20:00", endTime: "02:00" },
    ];
    const { container, onShowMore } = await mount();

    expect(container.textContent).toContain("今週の出勤");
    expect(container.textContent).toContain("10/13 20:00〜02:00　10/15 19:00〜01:00");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "もっと見る →") as HTMLButtonElement).click();
    });
    expect(onShowMore).toHaveBeenCalled();
  });

  it("says when there is no shift this week", async () => {
    mocks.schedules = [];
    const { container } = await mount();

    expect(container.textContent).toContain("今週の出勤予定はありません");
  });
});
