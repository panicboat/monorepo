// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  schedules: [] as { profileId: string; workDate: string; startTime: string; endTime: string }[],
  loading: false,
  error: undefined as Error | undefined,
  refresh: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/u/yuna" }));
vi.mock("@/modules/schedule/hooks", () => ({
  useSchedules: () => ({ schedules: mocks.schedules, loading: mocks.loading, error: mocks.error, refresh: mocks.refresh }),
  useSaveSchedule: () => mocks.save,
  useDeleteSchedule: () => mocks.remove,
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));

const { ScheduleBulkSheet } = await import("./ScheduleBulkSheet");

let onClose: Mock<() => void>;
let onSaved: Mock<() => void>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T09:00:00"));
  mocks.loading = false;
  mocks.error = undefined;
  mocks.schedules = [{ profileId: "p-1", workDate: "2026-10-13", startTime: "19:00", endTime: "01:00" }];
  for (const fn of [mocks.refresh, mocks.save, mocks.remove, mocks.toast]) fn.mockReset();
  mocks.save.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = "";
});

async function mount() {
  onClose = vi.fn<() => void>();
  onSaved = vi.fn<() => void>();
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(ScheduleBulkSheet, { profileId: "p-1", open: true, onClose, onSaved }));
  });
}

const text = () => document.body.textContent ?? "";
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label || b.getAttribute("aria-label") === label) as HTMLButtonElement | undefined;
const day = (label: string) => document.querySelector(`button[data-day="${label}"]`) as HTMLButtonElement;
const click = async (element: HTMLElement) => {
  await act(async () => {
    element.click();
  });
};
const announceSwitch = () => document.querySelector('button[role="switch"][aria-label="投稿でお知らせする"]') as HTMLButtonElement | null;
const noteField = () => document.querySelector('textarea[aria-label="ひとこと"]') as HTMLTextAreaElement | null;
const timeSelect = (part: "時" | "分") => document.querySelector(`select[aria-label="お知らせする時刻（${part}）"]`) as HTMLSelectElement | null;
const setValue = async (element: HTMLTextAreaElement | HTMLSelectElement, value: string) => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLSelectElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
};

describe("ScheduleBulkSheet", () => {
  it("shows two weeks from today with each day's current plan", async () => {
    await mount();

    expect(text()).toContain("予定をまとめて編集");
    expect(text()).toContain("予定 / 2週間まとめて編集");
    expect(text()).not.toContain("SHIFT");
    expect(text()).toContain("日付を複数選択して、同じ時間帯を一括で設定できます。1日ずつ入力する必要はありません。");
    expect(document.querySelectorAll("button[data-day]")).toHaveLength(14);
    expect(day("2026-10-12").textContent).toContain("10/12(月)");
    expect(day("2026-10-12").textContent).toContain("未設定");
    expect(day("2026-10-13").textContent).toContain("19:00 〜 01:00");
    expect(day("2026-10-25")).not.toBeNull();
  });

  it("lists the days one per row, marks a selected day and keeps the apply bar at the bottom", async () => {
    await mount();

    const list = day("2026-10-12").parentElement as HTMLElement;
    expect(list.className).toContain("flex-col");
    expect(list.className).not.toContain("grid-cols-7");
    expect(day("2026-10-12").className).not.toContain("border-accent");
    await click(day("2026-10-12"));
    expect(day("2026-10-12").className).toContain("border-accent");

    const bar = button("選択した日に反映")!.parentElement as HTMLElement;
    expect(bar.className).toContain("sticky");
    expect(bar.textContent).toContain("選択した日：1日");
  });

  it("puts the start and the end time on separate rows", async () => {
    await mount();

    const label = (name: string) => Array.from(document.querySelectorAll("span")).find((span) => span.textContent === name) as HTMLElement;
    expect(label("開始").parentElement).not.toBe(label("終了").parentElement);
  });

  it("selects days, counts them and selects the weekdays", async () => {
    await mount();

    await click(day("2026-10-12"));
    await click(day("2026-10-13"));
    expect(day("2026-10-12").getAttribute("aria-pressed")).toBe("true");
    expect(text()).toContain("選択した日：2日");

    await click(day("2026-10-12"));
    expect(text()).toContain("選択した日：1日");

    await click(button("平日を選択")!);
    expect(text()).toContain("選択した日：10日");
    expect(day("2026-10-17").getAttribute("aria-pressed")).toBe("false");
  });

  it("fills the times from a preset and waits for times and days before applying", async () => {
    await mount();

    expect(button("選択した日に反映")!.disabled).toBe(true);
    await click(day("2026-10-14"));
    expect(button("選択した日に反映")!.disabled).toBe(true);

    expect(button("20:00〜02:00")!.getAttribute("aria-pressed")).toBe("false");
    await click(button("20:00〜02:00")!);
    expect(button("20:00〜02:00")!.getAttribute("aria-pressed")).toBe("true");
    expect(button("18:00〜23:00")!.getAttribute("aria-pressed")).toBe("false");
    expect(button("選択した日に反映")!.disabled).toBe(false);
  });

  it("saves each selected day, confirms and closes", async () => {
    await mount();
    await click(day("2026-10-14"));
    await click(day("2026-10-15"));
    await click(button("18:00〜23:00")!);

    await click(button("選択した日に反映")!);

    const announcement = { announce: true, announceTime: "09:00", announceNote: "" };
    expect(mocks.save.mock.calls).toEqual([
      ["2026-10-14", "18:00", "23:00", announcement],
      ["2026-10-15", "18:00", "23:00", announcement],
    ]);
    expect(mocks.toast).toHaveBeenCalledWith("予定を更新しました");
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("announces the shift by default at 09:00 with an empty note", async () => {
    await mount();

    expect(announceSwitch()!.getAttribute("aria-checked")).toBe("true");
    expect(text()).toContain("投稿でお知らせする");
    expect(timeSelect("時")!.value).toBe("09");
    expect(timeSelect("分")!.value).toBe("00");
    expect(noteField()!.value).toBe("");
    expect(text()).toContain("お知らせする時刻");
  });

  it("saves the announcement time and the note with each day", async () => {
    await mount();
    await click(day("2026-10-14"));
    await click(day("2026-10-15"));
    await click(button("20:00〜02:00")!);
    await setValue(timeSelect("時")!, "08");
    await setValue(timeSelect("分")!, "30");
    await setValue(noteField()!, "お待ちしてます！");

    await click(button("選択した日に反映")!);

    const announcement = { announce: true, announceTime: "08:30", announceNote: "お待ちしてます！" };
    expect(mocks.save.mock.calls).toEqual([
      ["2026-10-14", "20:00", "02:00", announcement],
      ["2026-10-15", "20:00", "02:00", announcement],
    ]);
  });

  it("waits for the announcement time while announcing", async () => {
    await mount();
    await click(day("2026-10-14"));
    await click(button("18:00〜23:00")!);
    expect(button("選択した日に反映")!.disabled).toBe(false);

    await setValue(timeSelect("時")!, "");
    expect(button("選択した日に反映")!.disabled).toBe(true);

    await click(announceSwitch()!);
    expect(button("選択した日に反映")!.disabled).toBe(false);
  });

  it("limits the note to 200 characters", async () => {
    await mount();

    expect(noteField()!.maxLength).toBe(200);
  });

  it("hides the time and the note and saves without an announcement while the switch is off", async () => {
    await mount();
    await setValue(noteField()!, "お待ちしてます！");
    await click(announceSwitch()!);

    expect(announceSwitch()!.getAttribute("aria-checked")).toBe("false");
    expect(timeSelect("時")).toBeNull();
    expect(noteField()).toBeNull();
    expect(text()).not.toContain("お知らせする時刻");

    await click(day("2026-10-14"));
    await click(button("18:00〜23:00")!);
    await click(button("選択した日に反映")!);

    expect(mocks.save.mock.calls).toEqual([
      ["2026-10-14", "18:00", "23:00", { announce: false, announceTime: "", announceNote: "" }],
    ]);
  });

  it("offers the announcement only while adding plans and warns that clearing deletes the post", async () => {
    await mount();
    expect(text()).not.toContain("お知らせの投稿も消えます");

    await click(button("予定を消す")!);

    expect(announceSwitch()).toBeNull();
    expect(noteField()).toBeNull();
    expect(text()).toContain("お知らせの投稿も消えます");

    await click(button("予定を入れる")!);
    expect(announceSwitch()).not.toBeNull();
    expect(text()).not.toContain("お知らせの投稿も消えます");
  });

  it("clears only the days that have a plan", async () => {
    await mount();
    await click(day("2026-10-12"));
    await click(day("2026-10-13"));
    await click(button("予定を消す")!);

    expect(document.body.textContent).not.toContain("20:00〜02:00");
    await click(button("選択した日に反映")!);

    expect(mocks.remove.mock.calls).toEqual([["2026-10-13"]]);
    expect(mocks.save).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("keeps the sheet open on the days that failed", async () => {
    mocks.save.mockImplementation(async (workDate: string) => {
      if (workDate === "2026-10-16") throw new Error("failed");
    });
    await mount();
    await click(day("2026-10-15"));
    await click(day("2026-10-16"));
    await click(button("21:00〜03:00")!);

    await click(button("選択した日に反映")!);

    expect(text()).toContain("保存できなかった日があります: 10/16");
    expect(day("2026-10-16").getAttribute("aria-pressed")).toBe("true");
    expect(day("2026-10-15").getAttribute("aria-pressed")).toBe("false");
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("does not apply while the plans are loading or failed to load", async () => {
    mocks.loading = true;
    await mount();
    await click(day("2026-10-13"));
    await click(button("予定を消す")!);
    expect(button("選択した日に反映")!.disabled).toBe(true);
  });

  it("does not apply when loading the plans failed", async () => {
    mocks.error = new Error("failed");
    await mount();
    await click(day("2026-10-14"));
    await click(button("18:00〜23:00")!);
    expect(button("選択した日に反映")!.disabled).toBe(true);
  });

  it("waits for a planned day before clearing", async () => {
    await mount();
    await click(button("予定を消す")!);
    await click(day("2026-10-14"));
    expect(button("選択した日に反映")!.disabled).toBe(true);

    await click(day("2026-10-13"));
    expect(button("選択した日に反映")!.disabled).toBe(false);
  });

  it("ignores close requests until the apply finishes", async () => {
    let finish!: () => void;
    mocks.save.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    await mount();
    await click(day("2026-10-14"));
    await click(button("18:00〜23:00")!);

    await click(button("選択した日に反映")!);
    await click(button("閉じる")!);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      finish();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
