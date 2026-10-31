// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { AppError } from "@/lib/errors";

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

const setTime = async (label: string, value: string) => {
  const [hour, minute] = value.split(":");
  await setValue(document.querySelector(`select[aria-label="${label}（時）"]`) as HTMLSelectElement, hour);
  await setValue(document.querySelector(`select[aria-label="${label}（分）"]`) as HTMLSelectElement, minute);
};
const setTimes = async (start: string, end: string) => {
  await setTime("開始", start);
  await setTime("終了", end);
};

describe("ScheduleBulkSheet", () => {
  it("opens the current month of a calendar that runs through the end of next month", async () => {
    await mount();

    expect(text()).toContain("予定を編集");
    expect(text()).not.toContain("2週間");
    expect(text()).toContain("2026年 10月");
    expect(document.querySelectorAll("button[data-day]")).toHaveLength(20);
    expect(day("2026-10-11")).toBeNull();
    expect(day("2026-10-12").textContent).toBe("12");
    expect(day("2026-10-12").getAttribute("aria-label")).toBe("10/12(月) 未設定");
    expect(day("2026-10-13").textContent).toContain("19:00");
    expect(day("2026-10-13").getAttribute("aria-label")).toBe("10/13(火) 19:00 〜 01:00");
    expect(day("2026-10-31")).not.toBeNull();
  });

  it("keeps the selection while moving between the two months and stops at both ends", async () => {
    await mount();

    expect(button("前の月")!.disabled).toBe(true);
    await click(day("2026-10-12"));
    await click(button("次の月")!);

    expect(text()).toContain("2026年 11月");
    expect(button("次の月")!.disabled).toBe(true);
    expect(document.querySelectorAll("button[data-day]")).toHaveLength(30);
    await click(day("2026-11-30"));
    expect(text()).toContain("選択した日：2日");

    await click(button("前の月")!);
    expect(day("2026-10-12").getAttribute("aria-pressed")).toBe("true");
  });

  it("opens with no day selected", async () => {
    await mount();

    expect(document.querySelectorAll('button[data-day][aria-pressed="true"]')).toHaveLength(0);
    expect(text()).toContain("選択した日：0日");
  });

  it("lays the days out in a seven-column calendar, marks a selected day and keeps the apply bar at the bottom", async () => {
    await mount();

    expect((day("2026-10-12").parentElement as HTMLElement).className).toContain("grid-cols-7");
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

  it("selects days and counts them", async () => {
    await mount();

    await click(day("2026-10-12"));
    await click(day("2026-10-13"));
    expect(day("2026-10-12").getAttribute("aria-pressed")).toBe("true");
    expect(text()).toContain("選択した日：2日");

    await click(day("2026-10-12"));
    expect(text()).toContain("選択した日：1日");

    expect(text()).not.toContain("平日を選択");
  });

  it("waits for times and days before applying and suggests no times", async () => {
    await mount();

    expect(button("選択した日に反映")!.disabled).toBe(true);
    await click(day("2026-10-14"));
    expect(button("選択した日に反映")!.disabled).toBe(true);
    expect(button("20:00〜02:00")).toBeUndefined();

        await setTimes("20:00", "02:00");
    expect(button("選択した日に反映")!.disabled).toBe(false);
  });

  it("saves each selected day, confirms and closes", async () => {
    await mount();
    await click(day("2026-10-14"));
    await click(day("2026-10-15"));
    await setTimes("18:00", "23:00");

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

  it("announces the schedule by default at 09:00 with an empty note", async () => {
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
    await setTimes("20:00", "02:00");
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
    await setTimes("18:00", "23:00");
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
    await setTimes("18:00", "23:00");
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

  describe("telling what the switch does to a saved announcement", () => {
    const WILL_DELETE = "保存済みのお知らせの投稿は消えます";
    const WILL_REWRITE = "保存済みのお知らせの投稿は、この時刻とひとことで書き換わります";

    it("warns that the saved post is deleted while the switch is off and a selected day has a plan", async () => {
      await mount();
      await click(day("2026-10-13"));
      await click(announceSwitch()!);

      expect(text()).toContain(WILL_DELETE);
      expect(text()).not.toContain(WILL_REWRITE);
    });

    it("warns that the saved post is rewritten while the switch is on and a selected day has a plan", async () => {
      await mount();
      await click(day("2026-10-13"));

      expect(text()).toContain(WILL_REWRITE);
      expect(text()).not.toContain(WILL_DELETE);
    });

    it("says nothing when no selected day has a plan", async () => {
      await mount();
      expect(text()).not.toContain(WILL_REWRITE);

      await click(day("2026-10-14"));
      expect(text()).not.toContain(WILL_REWRITE);
      await click(announceSwitch()!);
      expect(text()).not.toContain(WILL_DELETE);
    });
  });

  describe("checking the announcement time against the schedule end", () => {
    const TOO_LATE = "お知らせの時刻は予定の終了より前にしてください";
    const pickSchedule = async (startTime: string, endTime: string, announceAt: string) => {
      await click(day("2026-10-14"));
      await setTime("開始", startTime);
      await setTime("終了", endTime);
      await setTime("お知らせする時刻", announceAt);
    };

    it("blocks a same-day schedule announced after its end", async () => {
      await mount();
      await pickSchedule("10:00", "15:00", "16:00");

      expect(button("選択した日に反映")!.disabled).toBe(true);
      expect(text()).toContain(TOO_LATE);
    });

    it("blocks a same-day schedule announced at its end", async () => {
      await mount();
      await pickSchedule("10:00", "15:00", "15:00");

      expect(button("選択した日に反映")!.disabled).toBe(true);
      expect(text()).toContain(TOO_LATE);
    });

    it("allows a same-day schedule announced before its end", async () => {
      await mount();
      await pickSchedule("10:00", "15:00", "14:00");

      expect(button("選択した日に反映")!.disabled).toBe(false);
      expect(text()).not.toContain(TOO_LATE);
    });

    it("treats a schedule starting at 05:00 as same-day", async () => {
      await mount();
      await pickSchedule("05:00", "08:00", "09:00");

      expect(button("選択した日に反映")!.disabled).toBe(true);
      expect(text()).toContain(TOO_LATE);
    });

    it("allows any announcement time on the work date for an overnight schedule", async () => {
      await mount();
      await pickSchedule("20:00", "02:00", "23:30");

      expect(button("選択した日に反映")!.disabled).toBe(false);
      expect(text()).not.toContain(TOO_LATE);
    });

    it("allows any announcement time on the work date for a schedule starting before 05:00", async () => {
      await mount();
      await pickSchedule("01:00", "05:00", "09:00");

      expect(button("選択した日に反映")!.disabled).toBe(false);
      expect(text()).not.toContain(TOO_LATE);
    });

    it("counts 03:00〜08:00 as next-day, so 09:00 on the work date is allowed", async () => {
      await mount();
      await pickSchedule("03:00", "08:00", "09:00");

      expect(button("選択した日に反映")!.disabled).toBe(false);
      expect(text()).not.toContain(TOO_LATE);
    });

    it("does not check the time while the switch is off", async () => {
      await mount();
      await pickSchedule("10:00", "15:00", "16:00");
      await click(announceSwitch()!);

      expect(button("選択した日に反映")!.disabled).toBe(false);
      expect(text()).not.toContain(TOO_LATE);
    });

    it("saves once the time is moved before the end", async () => {
      await mount();
      await pickSchedule("10:00", "15:00", "16:00");
      await setTime("お知らせする時刻", "14:00");

      await click(button("選択した日に反映")!);

      expect(mocks.save.mock.calls).toEqual([["2026-10-14", "10:00", "15:00", { announce: true, announceTime: "14:00", announceNote: "" }]]);
    });
  });

  it("clears only the days that have a plan", async () => {
    await mount();
    await click(day("2026-10-12"));
    await click(day("2026-10-13"));
    await click(button("予定を消す")!);

    expect(document.body.textContent).not.toContain("開始");
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
    await setTimes("21:00", "03:00");

    await click(button("選択した日に反映")!);

    expect(text()).toContain("保存できなかった日があります: 10/16");
    expect(day("2026-10-16").getAttribute("aria-pressed")).toBe("true");
    expect(day("2026-10-15").getAttribute("aria-pressed")).toBe("false");
    expect(onClose).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  describe("explaining a failed save", () => {
    const TOO_EARLY = "お知らせの時刻は予定の終了より前にしてください";
    const TOO_LONG = "ひとことは200文字以内で入力してください";
    const rejectWith = (reasons: Record<string, AppError>) =>
      mocks.save.mockImplementation(async (workDate: string) => {
        if (reasons[workDate]) throw reasons[workDate];
      });
    const selectBoth = async () => {
      await click(day("2026-10-24"));
      await click(day("2026-10-25"));
      await setTimes("18:00", "23:00");
    };

    it("shows the validation message once after the failed days", async () => {
      const error = new AppError("VALIDATION", TOO_EARLY, 400);
      rejectWith({ "2026-10-24": error, "2026-10-25": error });
      await mount();
      await selectBoth();

      await click(button("選択した日に反映")!);

      expect(text()).toContain(`保存できなかった日があります: 10/24, 10/25（${TOO_EARLY}）`);
      expect(text().split(TOO_EARLY)).toHaveLength(2);
    });

    it("lists each distinct message", async () => {
      rejectWith({
        "2026-10-24": new AppError("VALIDATION", TOO_EARLY, 400),
        "2026-10-25": new AppError("VALIDATION", TOO_LONG, 400),
      });
      await mount();
      await selectBoth();

      await click(button("選択した日に反映")!);

      expect(text()).toContain(`保存できなかった日があります: 10/24, 10/25（${TOO_EARLY}、${TOO_LONG}）`);
    });

    it("gives no reason for a failure that is not a validation error", async () => {
      rejectWith({ "2026-10-24": new AppError("SERVER", "予期しないエラーが発生しました", 500) });
      await mount();
      await selectBoth();

      await click(button("選択した日に反映")!);

      expect(text()).toContain("保存できなかった日があります: 10/24");
      expect(text()).not.toContain("予期しないエラーが発生しました");
      expect(text()).not.toContain("（");
    });

    it("replaces the reason when the retry fails differently", async () => {
      rejectWith({ "2026-10-24": new AppError("VALIDATION", TOO_EARLY, 400) });
      await mount();
      await selectBoth();
      await click(button("選択した日に反映")!);
      expect(text()).toContain(TOO_EARLY);

      rejectWith({ "2026-10-24": new AppError("VALIDATION", TOO_LONG, 400) });
      await click(button("選択した日に反映")!);

      expect(text()).toContain(`保存できなかった日があります: 10/24（${TOO_LONG}）`);
      expect(text()).not.toContain(TOO_EARLY);
    });
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
    await setTimes("18:00", "23:00");
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
    await setTimes("18:00", "23:00");

    await click(button("選択した日に反映")!);
    await click(button("閉じる")!);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      finish();
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
