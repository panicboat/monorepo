// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ScheduleView } from "@/modules/schedule/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  schedules: [] as ScheduleView[],
  save: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/modules/schedule/hooks", () => ({
  useSchedules: () => ({ schedules: mocks.schedules, loading: false, refresh: mocks.refresh }),
  useSaveSchedule: () => mocks.save,
  useDeleteSchedule: () => vi.fn(),
}));

const { ScheduleSection } = await import("./ScheduleSection");

let container: HTMLDivElement;
let unmount: () => Promise<void>;

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  await act(async () => {
    root.render(createElement(ScheduleSection, { profileId: "cast-1", isOwner: true }));
  });
}

async function openDay(label: string) {
  const day = Array.from(container.querySelectorAll("li button")).find((button) => button.textContent?.startsWith(label));
  await act(async () => {
    (day as HTMLButtonElement).click();
  });
}

const timeOf = (label: string) =>
  ["時", "分"].map((part) => (container.querySelector(`select[aria-label="${label}（${part}）"]`) as HTMLSelectElement).value).join(":");

const saveButton = () => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "保存") as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-10T09:00:00"));
  mocks.schedules = [];
  mocks.save.mockReset().mockResolvedValue(undefined);
  mocks.refresh.mockReset();
});

afterEach(async () => {
  await unmount();
  vi.useRealTimers();
});

describe("ScheduleSection editing", () => {
  it("opens a scheduled day with its own times", async () => {
    mocks.schedules = [{ profileId: "cast-1", workDate: "2026-10-11", startTime: "20:00", endTime: "02:30" }];
    await mount();

    await openDay("10/11");

    expect([timeOf("開始時刻"), timeOf("終了時刻")]).toEqual(["20:00", "02:30"]);
  });

  it("opens an unscheduled day with the times of the closest earlier scheduled day", async () => {
    mocks.schedules = [
      { profileId: "cast-1", workDate: "2026-10-10", startTime: "18:00", endTime: "23:00" },
      { profileId: "cast-1", workDate: "2026-10-11", startTime: "20:00", endTime: "02:30" },
    ];
    await mount();

    await openDay("10/12");

    expect([timeOf("開始時刻"), timeOf("終了時刻")]).toEqual(["20:00", "02:30"]);
  });

  it("opens an unscheduled day empty when nothing is scheduled, and cannot save until both times are set", async () => {
    await mount();

    await openDay("10/10");

    expect([timeOf("開始時刻"), timeOf("終了時刻")]).toEqual([":", ":"]);
    expect(saveButton().disabled).toBe(true);
  });

  it("saves the shown times for the opened day", async () => {
    mocks.schedules = [{ profileId: "cast-1", workDate: "2026-10-10", startTime: "18:00", endTime: "23:00" }];
    await mount();
    await openDay("10/11");

    await act(async () => {
      saveButton().click();
    });

    expect(mocks.save.mock.calls).toEqual([["2026-10-11", "18:00", "23:00"]]);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});
