# Dystopia Profile Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** プロフィールの上部とタブをモックの形にして出勤をタブにし、出勤のまとめて編集・プロフィール編集・人格の追加・レビューの詳細をシートにする。

**Architecture:** 出勤は `ScheduleBulkSheet`（今の保存・削除 API を日ごとに呼ぶ）と、`ScheduleTab`・`WeeklyScheduleSummary` に分ける。`ProfileContentTabs` に先頭側のタブとタブの上の描画を足し、プロフィールのページがキャストとゲストで並びを組む。プロフィール編集のモーダルは `SideSheet` に載せ替える。レビューはカルテと同じく `ReviewCard`（要約）・`ReviewDetailSheet`（操作）・`ReviewList`（開閉）に分ける。

**Tech Stack:** Next.js 16 App Router / React 19 / zustand / SWR 2.5.1 / Radix Dialog（`SideSheet`）/ vitest 5 + happy-dom

**Spec:** `docs/superpowers/specs/2026-10-16-dystopia-profile-screens-design.md`

## Global Constraints

- 作業ディレクトリは worktree（`/Users/takanokenichi/GitHub/panicboat/monorepo/.worktrees/refactor-dystopia-design-foundation`）。ブランチは `feat/dystopia-profile-screens`
- frontend のコマンドは `dystopia/frontend` で `env -u NODE_OPTIONS pnpm exec ...` として実行する
- `src/app/api`・`src/stub`・`proto`・`dystopia/monolith` を変更しない。API を呼ぶ箇所のリクエスト内容も変更しない
- モックにしかない機能は追加しない。現行にしかない機能は削除しない
- 作成ボタンの花形メニューとモバイルの FAB は変更しない
- シートは第 1 段の `SideSheet`（`src/components/ui/side-sheet.tsx`）を使う
- 画面の文言は spec と各 Task の表のとおりに一字一句合わせる
- 依存を追加しない
- コードコメントは英語・1 行・「なぜ他のやり方を採らなかったか」だけ。タスクや変更への言及を書かない
- コミットは `git commit -s`。`Co-Authored-By` を付けない。メッセージは英語
- happy-dom のテストで zustand の store の値を変えるときは、`renderToStaticMarkup` ではなく `createRoot` + `act` で描く
- 今日の日付に依存するテストは `vi.useFakeTimers({ toFake: ["Date"] })` と `vi.setSystemTime(new Date("2026-10-12T09:00:00"))`（月曜日）で固定し、`afterEach` で `vi.useRealTimers()` に戻す

## Review Focus

- まとめて編集で「予定を消す」を選んだとき、予定のない日には削除を送らない（Task 1）
- まとめて編集の途中で一部の日だけ失敗しても、成功した日はそのまま反映され、失敗した日だけが選んだまま残る（Task 1）
- 出勤タブを選んでいるときは、上の「今週の出勤」を出さない（Task 3）
- レビューの詳細シートで非表示にしたあと、一覧の取り直しでシートの中の状態も新しくなる（Task 5）
- 同じパスでクエリだけ違うリンクを投稿詳細シートで押すと、移動したうえでシートが閉じる（Task 6）

---

## File Structure

frontend（`dystopia/frontend/src/`）:

| ファイル | 責務 | Task |
|---|---|---|
| `modules/schedule/lib/dates.ts` | 「10/13」の表記 | 1 |
| `modules/schedule/components/ScheduleBulkSheet.tsx` | まとめて編集のシート | 1 |
| `modules/schedule/components/ScheduleTab.tsx` | 出勤タブ | 2 |
| `modules/schedule/components/WeeklyScheduleSummary.tsx` | 今週の出勤の要約 | 2 |
| `modules/schedule/index.ts` | export（`ScheduleSection` を外す） | 2 |
| `modules/post/components/ProfileContentTabs.tsx` | 先頭側のタブ、タブの上、フェード | 3 |
| `modules/profile/components/ProfileHeader.tsx` | チップの位置 | 3 |
| `app/u/[username]/page.tsx` | タブの並びと今週の出勤 | 3, 4, 5 |
| `modules/profile/components/EditProfileSheet.tsx` | プロフィール編集のシート（`EditProfileModal` を置き換え） | 4 |
| `modules/profile/components/AddProfileSheet.tsx` | 人格の追加のシート | 4 |
| `modules/profile/components/ProfileManager.tsx` | 追加をシートで開く | 4 |
| `modules/review/components/ReviewCard.tsx`, `ReviewDetailSheet.tsx`, `ReviewList.tsx` | レビューの要約・詳細・一覧 | 5 |
| `modules/review/components/ReviewsTab.tsx` | 一覧と「レビューを書く」 | 5 |
| `components/compose/ComposeToSheet.tsx` | 保存のあとの呼び出し（`onSaved`） | 5 |
| `modules/post/components/PostDetailSheet.tsx` | 同じパスのクエリ違いで閉じる | 6 |

削除: `ScheduleSection.tsx` と test（Task 2）、`EditProfileModal.tsx`（test は `EditProfileSheet.test.tsx` に移す。Task 4）、`ReviewEntryCard.tsx` と 2 つの test（Task 5）。

---

### Task 1: Schedule bulk sheet

**Files:**
- Modify: `dystopia/frontend/src/modules/schedule/lib/dates.ts`, `lib/dates.test.ts`
- Create: `dystopia/frontend/src/modules/schedule/components/ScheduleBulkSheet.tsx`, `ScheduleBulkSheet.test.tsx`

**Interfaces:**
- Consumes: `useSchedules(profileId: string | null, fromDate: string, toDate: string)` → `{ schedules: ScheduleView[]; loading; error; refresh }`、`useSaveSchedule()` → `(workDate, startTime, endTime) => Promise<void>`、`useDeleteSchedule()` → `(workDate) => Promise<void>`、`buildDateRange(start: Date, days: number): string[]`、`TimeSelect({ label, value, onChange })`、`useToastStore((s) => s.show)`
- Produces:
  - `formatMonthDay(dateKey: string): string`（`"2026-10-13"` → `"10/13"`、`modules/schedule/lib/dates.ts`）
  - `ScheduleBulkSheet({ profileId: string; open: boolean; onClose: () => void; onSaved: () => void })`

- [ ] **Step 1: Write the failing tests**

`src/modules/schedule/lib/dates.test.ts` の import に `formatMonthDay` を足し、末尾に足す:

```ts
describe("formatMonthDay", () => {
  it("shows a date key as month/day without leading zeros", () => {
    expect(formatMonthDay("2026-10-13")).toBe("10/13");
    expect(formatMonthDay("2026-01-05")).toBe("1/5");
  });
});
```

`src/modules/schedule/components/ScheduleBulkSheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  schedules: [] as { profileId: string; workDate: string; startTime: string; endTime: string }[],
  refresh: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/u/yuna" }));
vi.mock("@/modules/schedule/hooks", () => ({
  useSchedules: () => ({ schedules: mocks.schedules, loading: false, error: undefined, refresh: mocks.refresh }),
  useSaveSchedule: () => mocks.save,
  useDeleteSchedule: () => mocks.remove,
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));

const { ScheduleBulkSheet } = await import("./ScheduleBulkSheet");

let onClose: ReturnType<typeof vi.fn>;
let onSaved: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T09:00:00"));
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
  onClose = vi.fn();
  onSaved = vi.fn();
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

describe("ScheduleBulkSheet", () => {
  it("shows two weeks from today with each day's current plan", async () => {
    await mount();

    expect(text()).toContain("出勤予定をまとめて編集");
    expect(text()).toContain("SHIFT / 2週間まとめて編集");
    expect(text()).toContain("日付を複数選択して、同じ時間帯を一括で設定できます。1日ずつ入力する必要はありません。");
    expect(document.querySelectorAll("button[data-day]")).toHaveLength(14);
    expect(day("2026-10-12").textContent).toContain("未設定");
    expect(day("2026-10-13").textContent).toContain("19:00");
    expect(day("2026-10-25")).not.toBeNull();
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

    await click(button("20:00〜02:00")!);
    expect(button("選択した日に反映")!.disabled).toBe(false);
  });

  it("saves each selected day, confirms and closes", async () => {
    await mount();
    await click(day("2026-10-14"));
    await click(day("2026-10-15"));
    await click(button("18:00〜23:00")!);

    await click(button("選択した日に反映")!);

    expect(mocks.save.mock.calls).toEqual([
      ["2026-10-14", "18:00", "23:00"],
      ["2026-10-15", "18:00", "23:00"],
    ]);
    expect(mocks.toast).toHaveBeenCalledWith("出勤予定を更新しました");
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/schedule > /tmp/profile-vitest.txt 2>&1; tail -15 /tmp/profile-vitest.txt`
Expected: FAIL（`formatMonthDay`・`ScheduleBulkSheet` がない）

- [ ] **Step 3: Implement the date helper**

`src/modules/schedule/lib/dates.ts` の末尾に足す:

```ts
export function formatMonthDay(dateKey: string): string {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}
```

- [ ] **Step 4: Implement the sheet**

`src/modules/schedule/components/ScheduleBulkSheet.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { cn } from "@/lib/utils";
import { useDeleteSchedule, useSaveSchedule, useSchedules } from "@/modules/schedule/hooks";
import { buildDateRange, formatMonthDay } from "@/modules/schedule/lib/dates";
import { useToastStore } from "@/stores/toastStore";
import { TimeSelect } from "./TimeSelect";

const DAYS = 14;
const PRESETS = [
  ["20:00", "02:00"],
  ["18:00", "23:00"],
  ["21:00", "03:00"],
] as const;

type Mode = "work" | "clear";

const chipClass = (selected: boolean) =>
  cn(
    "min-h-11 rounded-full border px-4 text-sm",
    selected ? "border-accent bg-accent/15 text-text-primary" : "border-border text-text-secondary hover:text-text-primary"
  );

interface ScheduleBulkSheetProps {
  profileId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ScheduleBulkSheet({ profileId, open, onClose, onSaved }: ScheduleBulkSheetProps) {
  const days = useMemo(() => buildDateRange(new Date(), DAYS), []);
  const { schedules, refresh } = useSchedules(profileId, days[0], days[DAYS - 1]);
  const saveSchedule = useSaveSchedule();
  const deleteSchedule = useDeleteSchedule();
  const showToast = useToastStore((s) => s.show);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<Mode>("work");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  const byDate = new Map(schedules.map((s) => [s.workDate, s]));
  const ready = selected.size > 0 && (mode === "clear" || (start !== "" && end !== ""));

  const toggle = (dateKey: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });

  const selectWeekdays = () =>
    setSelected(
      new Set(
        days.filter((dateKey) => {
          const weekday = new Date(`${dateKey}T00:00:00`).getDay();
          return weekday >= 1 && weekday <= 5;
        })
      )
    );

  const apply = async () => {
    setSaving(true);
    setFailed([]);
    const failures: string[] = [];
    for (const dateKey of days.filter((key) => selected.has(key))) {
      if (mode === "clear" && !byDate.has(dateKey)) continue;
      try {
        if (mode === "work") await saveSchedule(dateKey, start, end);
        else await deleteSchedule(dateKey);
      } catch {
        failures.push(dateKey);
      }
    }
    setSaving(false);
    refresh();
    onSaved();
    if (failures.length === 0) {
      showToast("出勤予定を更新しました");
      onClose();
      return;
    }
    setFailed(failures);
    setSelected(new Set(failures));
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="出勤予定をまとめて編集"
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs font-bold tracking-wide text-text-secondary">SHIFT / 2週間まとめて編集</p>
          <p className="mt-1 text-sm text-text-secondary">日付を複数選択して、同じ時間帯を一括で設定できます。1日ずつ入力する必要はありません。</p>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {days.map((dateKey) => {
            const plan = byDate.get(dateKey);
            const isSelected = selected.has(dateKey);
            return (
              <button
                key={dateKey}
                type="button"
                data-day={dateKey}
                aria-pressed={isSelected}
                onClick={() => toggle(dateKey)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-xs",
                  isSelected ? "border-accent bg-accent/15 text-text-primary" : "border-border text-text-secondary"
                )}
              >
                <span className="font-bold">{formatMonthDay(dateKey)}</span>
                {plan ? (
                  <>
                    <span>{plan.startTime}</span>
                    <span>〜{plan.endTime}</span>
                  </>
                ) : (
                  <span>未設定</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-text-primary">選択した日：{selected.size}日</p>
            <button type="button" onClick={selectWeekdays} className="min-h-11 text-sm text-accent hover:underline">
              平日を選択
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <button type="button" aria-pressed={mode === "work"} onClick={() => setMode("work")} className={chipClass(mode === "work")}>
              出勤
            </button>
            <button type="button" aria-pressed={mode === "clear"} onClick={() => setMode("clear")} className={chipClass(mode === "clear")}>
              予定を消す
            </button>
          </div>
          {mode === "work" && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                <span>開始</span>
                <TimeSelect label="開始" value={start} onChange={setStart} />
                <span>終了</span>
                <TimeSelect label="終了" value={end} onChange={setEnd} />
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map(([presetStart, presetEnd]) => (
                  <button
                    key={presetStart}
                    type="button"
                    onClick={() => {
                      setStart(presetStart);
                      setEnd(presetEnd);
                    }}
                    className={chipClass(start === presetStart && end === presetEnd)}
                  >
                    {presetStart}〜{presetEnd}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {failed.length > 0 && (
          <p className="text-sm text-error" role="alert">
            保存できなかった日があります: {failed.map(formatMonthDay).join(", ")}
          </p>
        )}
        <Button type="button" disabled={!ready || saving} onClick={() => void apply()}>
          選択した日に反映
        </Button>
      </div>
    </SideSheet>
  );
}
```

`TimeSelect` は `label` を時・分の選択欄の読み上げ名（`開始（時）` など）に使う。「開始」「終了」の `span` は見た目の文字として置く。

- [ ] **Step 5: Run the tests to verify they pass**

Run: Step 2 と同じコマンド
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd dystopia/frontend
git add src/modules/schedule/lib/dates.ts src/modules/schedule/lib/dates.test.ts src/modules/schedule/components/ScheduleBulkSheet.tsx src/modules/schedule/components/ScheduleBulkSheet.test.tsx
git commit -s -m "feat(dystopia/frontend): edit two weeks of shifts at once in a sheet"
```

---

### Task 2: Schedule tab and weekly summary

**Files:**
- Create: `dystopia/frontend/src/modules/schedule/components/ScheduleTab.tsx`, `ScheduleTab.test.tsx`
- Create: `dystopia/frontend/src/modules/schedule/components/WeeklyScheduleSummary.tsx`, `WeeklyScheduleSummary.test.tsx`
- Modify: `dystopia/frontend/src/modules/schedule/index.ts`
- Delete: `dystopia/frontend/src/modules/schedule/components/ScheduleSection.tsx`, `ScheduleSection.test.tsx`

**Interfaces:**
- Consumes: Task 1 の `ScheduleBulkSheet`・`formatMonthDay`
- Produces: `ScheduleTab({ profileId: string; isOwner: boolean })`、`WeeklyScheduleSummary({ profileId: string; onShowMore: () => void })`。`@/modules/schedule` から `ScheduleTab`・`WeeklyScheduleSummary` を export する

- [ ] **Step 1: Write the failing tests**

`src/modules/schedule/components/ScheduleTab.test.tsx`:

```tsx
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
```

`src/modules/schedule/components/WeeklyScheduleSummary.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/schedule > /tmp/profile-vitest.txt 2>&1; tail -15 /tmp/profile-vitest.txt`
Expected: FAIL（`ScheduleTab`・`WeeklyScheduleSummary` がない）

- [ ] **Step 3: Implement the tab and the summary**

`src/modules/schedule/components/ScheduleTab.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSchedules } from "@/modules/schedule/hooks";
import { buildDateRange, formatMonthDay } from "@/modules/schedule/lib/dates";
import { ScheduleBulkSheet } from "./ScheduleBulkSheet";

const DAYS = 7;

interface Editing {
  session: number;
  open: boolean;
}

export function ScheduleTab({ profileId, isOwner }: { profileId: string; isOwner: boolean }) {
  const days = useMemo(() => buildDateRange(new Date(), DAYS), []);
  const { schedules, loading, refresh } = useSchedules(profileId, days[0], days[DAYS - 1]);
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [editing, setEditing] = useState<Editing | null>(null);
  const byDate = new Map(schedules.map((s) => [s.workDate, s]));

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary">出勤スケジュール</h2>
        {isOwner && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
          >
            まとめて編集
          </Button>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-text-secondary">読み込み中…</p>
      ) : (
        <ol className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((dateKey) => {
            const plan = byDate.get(dateKey);
            return (
              <li
                key={dateKey}
                className={cn(
                  "flex min-h-20 flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center text-xs",
                  plan ? "border-accent/50 bg-accent/10 text-text-primary" : "border-border text-text-secondary"
                )}
              >
                <span className="font-bold">{formatMonthDay(dateKey)}</span>
                {plan ? (
                  <>
                    <span>{plan.startTime}</span>
                    <span>〜{plan.endTime}</span>
                  </>
                ) : (
                  <span>未設定</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 text-xs text-text-secondary">出勤情報は予約可能枠を保証するものではありません。</p>
      {editing && (
        <ScheduleBulkSheet
          key={editing.session}
          profileId={profileId}
          open={editing.open}
          onClose={() => setEditing((current) => current && { ...current, open: false })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
```

`src/modules/schedule/components/WeeklyScheduleSummary.tsx`:

```tsx
"use client";

import { useMemo } from "react";
import { useSchedules } from "@/modules/schedule/hooks";
import { buildDateRange, formatMonthDay } from "@/modules/schedule/lib/dates";

const DAYS = 7;

export function WeeklyScheduleSummary({ profileId, onShowMore }: { profileId: string; onShowMore: () => void }) {
  const days = useMemo(() => buildDateRange(new Date(), DAYS), []);
  const { schedules, loading } = useSchedules(profileId, days[0], days[DAYS - 1]);

  if (loading) return null;

  const shifts = [...schedules]
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
    .map((s) => `${formatMonthDay(s.workDate)} ${s.startTime}〜${s.endTime}`);

  return (
    <section aria-label="今週の出勤" className="mx-4 mt-4 rounded-xl border border-border bg-surface px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-primary">今週の出勤</h2>
        <button type="button" onClick={onShowMore} className="min-h-11 text-sm text-accent hover:underline">
          もっと見る →
        </button>
      </div>
      <p className="pb-1 text-sm text-text-secondary">{shifts.length > 0 ? shifts.join("　") : "今週の出勤予定はありません"}</p>
    </section>
  );
}
```

`src/modules/schedule/index.ts` を次に替える:

```ts
export { ScheduleTab } from "./components/ScheduleTab";
export { WeeklyScheduleSummary } from "./components/WeeklyScheduleSummary";
export type { ScheduleView } from "./types";
```

`ScheduleSection.tsx` と `ScheduleSection.test.tsx` を `git rm` する。`grep -rn "ScheduleSection" src` で、残る参照が `src/app/u/[username]/page.tsx` だけであることを確かめる（Task 3 で直す。このコミットでは page.tsx の `ScheduleSection` の import と使用を外し、出勤をまだ出さない状態でよい）。

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/schedule "src/app/u" > /tmp/profile-vitest.txt 2>&1; tail -8 /tmp/profile-vitest.txt`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd dystopia/frontend
git add -A src/modules/schedule "src/app/u/[username]/page.tsx"
git commit -s -m "feat(dystopia/frontend): show a week of shifts as a tab and a weekly summary"
```

---
### Task 3: Profile header, tab order and the weekly summary

**Files:**
- Modify: `dystopia/frontend/src/modules/post/components/ProfileContentTabs.tsx`
- Create: `dystopia/frontend/src/modules/post/components/ProfileContentTabs.order.test.tsx`
- Modify: `dystopia/frontend/src/modules/profile/components/ProfileHeader.tsx`, `ProfileHeader.test.tsx`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`, `page.test.tsx`

**Interfaces:**
- Consumes: Task 2 の `ScheduleTab`・`WeeklyScheduleSummary`（`@/modules/schedule`）、`useEnterAnimation(ref, key)`
- Produces: `ProfileContentTabs` の props に `leadingTabs?: ExtraTab[]`（「投稿」の直後に並ぶ）と `renderAboveTabs?: (tab: string, selectTab: (id: string) => void) => ReactNode`

- [ ] **Step 1: Write the failing tests**

`src/modules/post/components/ProfileContentTabs.order.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const emptyPosts = { posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() };
vi.mock("@/modules/post/hooks/useAuthorPosts", () => ({ useAuthorPosts: () => emptyPosts }));
vi.mock("@/modules/post/hooks/useAuthorLikedPosts", () => ({ useAuthorLikedPosts: () => emptyPosts }));
vi.mock("@/modules/post/hooks/useAuthorComments", () => ({
  useAuthorComments: () => ({ comments: [], postsById: {}, hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
}));

const { ProfileContentTabs } = await import("./ProfileContentTabs");

describe("ProfileContentTabs order and above-tabs content", () => {
  it("puts the leading tabs right after posts and the extra tabs at the end", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(ProfileContentTabs, {
          profileId: "p-1",
          isOwnProfile: true,
          leadingTabs: [
            { id: "schedule", label: "出勤", content: <div>schedule-pane</div> },
            { id: "reviews", label: "レビュー", content: <div>reviews-pane</div> },
          ],
          extraTabs: [{ id: "extra", label: "おまけ", content: <div>extra-pane</div> }],
        })
      );
    });

    expect(Array.from(container.querySelectorAll('[role="tab"]')).map((t) => t.textContent)).toEqual([
      "投稿", "出勤", "レビュー", "返信", "メディア", "いいね", "おまけ",
    ]);
  });

  it("renders above the tabs with the selected tab and a way to switch", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(ProfileContentTabs, {
          profileId: "p-1",
          leadingTabs: [{ id: "schedule", label: "出勤", content: <div>schedule-pane</div> }],
          renderAboveTabs: (tab: string, selectTab: (id: string) => void) =>
            tab === "schedule" ? null : (
              <button type="button" onClick={() => selectTab("schedule")}>
                above:{tab}
              </button>
            ),
        })
      );
    });
    expect(container.textContent).toContain("above:posts");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "above:posts") as HTMLButtonElement).click();
    });

    expect(container.textContent).not.toContain("above:");
    expect(container.textContent).toContain("schedule-pane");
  });
});
```

`src/modules/profile/components/ProfileHeader.test.tsx` に足す:

```tsx
  it("shows the role and the area as chips below the bio", () => {
    const html = renderToStaticMarkup(
      <ProfileHeader profile={{ ...emptyProfileView("p-1"), displayName: "ゆな", bio: "よろしく", prefecture: "東京都" }} role="cast" />
    );

    expect(html.indexOf("よろしく")).toBeLessThan(html.indexOf("キャスト"));
    expect(html.indexOf("キャスト")).toBeLessThan(html.indexOf("東京都"));
  });
```

（`emptyProfileView` の import がなければ `import { emptyProfileView } from "@/modules/profile/lib/mappers";` を足す）

`src/app/u/[username]/page.test.tsx` の `ProfileContentTabs` の mock を、`leadingTabs` と `extraTabs` の両方のラベルを出し、`renderAboveTabs("posts", () => {})` の結果も出す形に替える:

```tsx
vi.mock("@/modules/post/components/ProfileContentTabs", () => ({
  ProfileContentTabs: ({
    leadingTabs,
    extraTabs,
    renderAboveTabs,
  }: {
    leadingTabs?: { id: string; label: string }[];
    extraTabs?: { id: string; label: string }[];
    renderAboveTabs?: (tab: string, selectTab: (id: string) => void) => import("react").ReactNode;
  }) => (
    <div>
      {renderAboveTabs?.("posts", () => {})}
      {[...(leadingTabs ?? []), ...(extraTabs ?? [])].map((t) => (
        <span key={t.id}>{t.label}</span>
      ))}
    </div>
  ),
}));
vi.mock("@/modules/schedule", () => ({
  ScheduleTab: () => null,
  WeeklyScheduleSummary: () => <span>weekly-summary</span>,
}));
```

同じファイルの既存の `@/modules/schedule` の mock があれば、上のものに置き換える。ファイル末尾の `describe("PublicProfilePage karte tab visibility", ...)` の後に足す:

```tsx
describe("PublicProfilePage tabs", () => {
  it("leads a cast profile with shifts and reviews and shows the weekly summary", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };
    mocks.viewerRole = "guest";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html.indexOf("出勤")).toBeLessThan(html.indexOf("レビュー"));
    expect(html).toContain("weekly-summary");
  });

  it("gives a guest profile no weekly summary", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 1 };
    mocks.viewerRole = "cast";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).not.toContain("weekly-summary");
    expect(html.indexOf("カルテ")).toBeLessThan(html.indexOf("レビュー"));
  });
});
```


- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/post/components/ProfileContentTabs src/modules/profile/components/ProfileHeader.test.tsx "src/app/u" > /tmp/profile-vitest.txt 2>&1; tail -15 /tmp/profile-vitest.txt`
Expected: FAIL

- [ ] **Step 3: Implement the tabs**

`src/modules/post/components/ProfileContentTabs.tsx`:

- import に `useRef` を足し（`react` から）、`import { useEnterAnimation } from "@/lib/motion/useEnterAnimation";` を足す
- `ProfileContentTabsProps` に足す:

```tsx
  leadingTabs?: ExtraTab[];
  renderAboveTabs?: (tab: string, selectTab: (id: string) => void) => ReactNode;
```

- 関数の引数を `{ profileId, isOwnProfile = true, leadingTabs = [], extraTabs = [], renderAboveTabs }` に替え、`allItems` と `extraTab` を次に替える:

```tsx
  const [postsItem, ...restItems] = tabItems as unknown as { id: string; label: string }[];
  const allItems = [
    postsItem,
    ...leadingTabs.map((t) => ({ id: t.id, label: t.label })),
    ...restItems,
    ...extraTabs.map((t) => ({ id: t.id, label: t.label })),
  ];
  const customTab = [...leadingTabs, ...extraTabs].find((t) => t.id === tab);
  const contentRef = useRef<HTMLDivElement>(null);
  useEnterAnimation(contentRef, tab);
```

- 戻り値を次に替える:

```tsx
  return (
    <>
      {renderAboveTabs?.(tab, setTab)}
      <section className="mt-4">
        <Tabs items={allItems} value={tab} onValueChange={setTab} />
        <div ref={contentRef}>
          {tab === "posts" && <AuthorPostsPane profileId={profileId} mediaOnly={false} />}
          {tab === "replies" && <AuthorRepliesPane profileId={profileId} />}
          {tab === "media" && <AuthorPostsPane profileId={profileId} mediaOnly={true} />}
          {tab === "likes" && isOwnProfile && <AuthorLikesPane profileId={profileId} />}
          {customTab?.content}
        </div>
      </section>
    </>
  );
```

- [ ] **Step 4: Implement the header**

`src/modules/profile/components/ProfileHeader.tsx`:

- 名前の行（`<div className="flex items-center gap-2">`）から、役割の `<span className={...}>{isCast ? "キャスト" : "ゲスト"}</span>` を外す
- 都道府県と登録日の行から `{profile.prefecture && <span>{profile.prefecture}</span>}` を外す
- `{profile.bio && <p ...>}` の直後に、チップの行を足す:

```tsx
        <div className="flex flex-wrap gap-2 pt-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs ${
              isCast ? "bg-accent/15 text-accent" : "bg-text-secondary/10 text-text-secondary"
            }`}
          >
            {isCast ? "キャスト" : "ゲスト"}
          </span>
          {profile.prefecture && (
            <span className="rounded-full bg-text-secondary/10 px-2.5 py-0.5 text-xs text-text-secondary">{profile.prefecture}</span>
          )}
        </div>
```

- 登録日の行は、登録日がないときに空の `div` が残らないよう `{registeredLabel && (<div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-text-secondary"><span className="inline-flex items-center gap-1"><CalendarDays className="size-4" />{registeredLabel}</span></div>)}` に替える

- [ ] **Step 5: Wire the profile page**

`src/app/u/[username]/page.tsx`:

- import に `import { ScheduleTab, WeeklyScheduleSummary } from "@/modules/schedule";` を足す（Task 2 で外した `ScheduleSection` の import が残っていれば消す）
- `<ProfileContentTabs ... />` を次に替える:

```tsx
      <ProfileContentTabs
        profileId={profile.id}
        isOwnProfile={isOwnProfile}
        leadingTabs={
          role === "cast"
            ? [
                { id: "schedule", label: "出勤", content: <ScheduleTab profileId={profile.id} isOwner={isOwnProfile} /> },
                { id: "reviews", label: "レビュー", content: <ReviewsTab profileId={profile.id} mode="received" /> },
              ]
            : viewerRole === "cast"
              ? [{ id: "karte", label: "カルテ", content: <GuestKarteTab guest={guestView} /> }]
              : []
        }
        extraTabs={
          role === "guest"
            ? [{ id: "reviews", label: "レビュー", content: <ReviewsTab profileId={profile.id} mode="written" /> }]
            : []
        }
        renderAboveTabs={
          role === "cast"
            ? (tab, selectTab) =>
                tab === "schedule" ? null : (
                  <WeeklyScheduleSummary profileId={profile.id} onShowMore={() => selectTab("schedule")} />
                )
            : undefined
        }
      />
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: Step 2 と同じコマンド
Expected: PASS

- [ ] **Step 7: Commit**

```bash
cd dystopia/frontend
git add src/modules/post/components/ProfileContentTabs.tsx src/modules/post/components/ProfileContentTabs.order.test.tsx src/modules/profile/components/ProfileHeader.tsx src/modules/profile/components/ProfileHeader.test.tsx "src/app/u/[username]/page.tsx" "src/app/u/[username]/page.test.tsx"
git commit -s -m "feat(dystopia/frontend): lead profiles with the mock's tabs and a weekly shift summary"
```

---

### Task 4: Profile edit and add-profile sheets

**Files:**
- Rename: `dystopia/frontend/src/modules/profile/components/EditProfileModal.tsx` → `EditProfileSheet.tsx`、`EditProfileModal.test.tsx` → `EditProfileSheet.test.tsx`
- Create: `dystopia/frontend/src/modules/profile/components/AddProfileSheet.tsx`, `AddProfileSheet.test.tsx`
- Modify: `dystopia/frontend/src/modules/profile/components/ProfileManager.tsx`, `ProfileManager.test.tsx`
- Modify: `dystopia/frontend/src/app/u/[username]/page.tsx`, `dystopia/frontend/src/app/dev/ui/page.tsx`

**Interfaces:**
- Produces: `EditProfileSheet`（props は `EditProfileModal` と同じ: `{ open; onOpenChange; profile; isCast; onSave; onSaveMedia }`）、`AddProfileSheet({ open: boolean; onClose: () => void; onSubmit: (payload: Required<CreateProfilePayload>) => Promise<void> })`

- [ ] **Step 1: Rename and write the failing tests**

```bash
cd dystopia/frontend/src/modules/profile/components
git mv EditProfileModal.tsx EditProfileSheet.tsx
git mv EditProfileModal.test.tsx EditProfileSheet.test.tsx
```

`EditProfileSheet.test.tsx`:

- `const { EditProfileModal } = await import("./EditProfileModal");` を `const { EditProfileSheet } = await import("./EditProfileSheet");` に替え、`createElement(EditProfileModal, ...)` を `createElement(EditProfileSheet, ...)` に、`describe("EditProfileModal"` を `describe("EditProfileSheet"` に替える
- import の後に `vi.mock("next/navigation", () => ({ usePathname: () => "/u/yuna" }));` を足し、`vitest` の import に `vi` を足す（`SideSheet` が `usePathname` を使うため）
- `describe` の中に足す:

```tsx
  it("opens as a sheet that says which profile is being edited", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(EditProfileSheet, {
          open: true,
          onOpenChange: () => {},
          profile: { ...emptyProfileView("p1"), displayName: "ゆな", username: "yuna" },
          isCast: true,
          onSave: async () => {},
          onSaveMedia: async () => {},
        })
      );
    });

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("プロフィールを編集");
    expect(document.body.textContent).toContain("ゆなとして編集中");
    expect(document.body.textContent).toContain("@yuna");
  });
```

`src/modules/profile/components/AddProfileSheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));

const { AddProfileSheet } = await import("./AddProfileSheet");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AddProfileSheet", () => {
  it("explains what it adds and submits the name form", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(AddProfileSheet, { open: true, onClose: vi.fn(), onSubmit }));
    });

    expect(document.body.textContent).toContain("プロフィールを追加");
    expect(document.body.textContent).toContain("別の活動名で使うプロフィールを追加できます。");
    expect(document.querySelector('[role="dialog"] form')).not.toBeNull();
  });
});
```

`src/modules/profile/components/ProfileManager.test.tsx` の、追加フォームを開くテスト（「プロフィールを追加」ボタンを押してフォームが出ることを確かめているもの）を、押すと `AddProfileSheet` が開く形に替える。ファイル先頭で `vi.mock("./AddProfileSheet", () => ({ AddProfileSheet: ({ open }: { open: boolean }) => <div>add-sheet:{String(open)}</div> }))` を足し、ボタンを押したあと `add-sheet:true` が出ることを確かめる。

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/profile > /tmp/profile-vitest.txt 2>&1; tail -15 /tmp/profile-vitest.txt`
Expected: FAIL（`EditProfileSheet` がまだダイアログで「として編集中」がない、`AddProfileSheet` がない）

- [ ] **Step 3: Put the edit form in a sheet**

`src/modules/profile/components/EditProfileSheet.tsx`:

- `import * as Dialog from "@radix-ui/react-dialog";` と `import { X } from "lucide-react";` を消し、`import { SideSheet } from "@/components/ui/side-sheet";` を足す
- `interface EditProfileModalProps` を `interface EditProfileSheetProps` に、`export function EditProfileModal(` を `export function EditProfileSheet(` に替える
- `return (` から `<div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">` までを次に替える:

```tsx
  return (
    <SideSheet open={open} onOpenChange={onOpenChange} title="プロフィールを編集">
      <div className="flex flex-col gap-4">
        <div className="rounded-lg bg-surface px-3 py-2">
          <p className="text-sm font-bold text-text-primary">{profile.displayName}として編集中</p>
          <p className="text-xs text-text-secondary">@{profile.username}</p>
        </div>
```

- 末尾の `<div className="flex justify-end gap-2 border-t border-divider px-4 py-3">` から `</Dialog.Root>` までを次に替える（ボタンの中身は今のまま）:

```tsx
        <div className="flex justify-end gap-2 border-t border-divider pt-4">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            キャンセル
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "保存"}
          </Button>
        </div>
      </div>
    </SideSheet>
```

（`{error && ...}` は本文の `div` の中、ボタンの行の前に残す。本文を包んでいた `overflow-y-auto` の `div` の閉じタグは、上のボタンの行の後の `</div>` に合わせて 1 つにまとめる）

- `src/app/u/[username]/page.tsx` と `src/app/dev/ui/page.tsx` の `EditProfileModal` を `EditProfileSheet` に替える（import のパスも `EditProfileSheet` に）

- [ ] **Step 4: Implement the add-profile sheet and open it from the manager**

`src/modules/profile/components/AddProfileSheet.tsx`:

```tsx
"use client";

import { SideSheet } from "@/components/ui/side-sheet";
import type { CreateProfilePayload } from "@/modules/profile/types";
import { ProfileNameForm } from "./ProfileNameForm";

interface AddProfileSheetProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: Required<CreateProfilePayload>) => Promise<void>;
}

export function AddProfileSheet({ open, onClose, onSubmit }: AddProfileSheetProps) {
  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="プロフィールを追加"
    >
      <p className="mb-4 text-sm text-text-secondary">別の活動名で使うプロフィールを追加できます。</p>
      <ProfileNameForm submitLabel="追加して切り替える" onCancel={onClose} onSubmit={onSubmit} />
    </SideSheet>
  );
}
```

`src/modules/profile/components/ProfileManager.tsx`:

- import に `import { AddProfileSheet } from "@/modules/profile/components/AddProfileSheet";` を足す
- `const [adding, setAdding] = useState(false);` を次に替える:

```tsx
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [adding, setAdding] = useState<{ session: number; open: boolean } | null>(null);
```

- `{adding ? (<ProfileNameForm .../>) : (<Button ...>プロフィールを追加</Button>)}` を次に替える:

```tsx
          <Button
            type="button"
            variant="secondary"
            onClick={() => setAdding((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
          >
            プロフィールを追加
          </Button>
          {adding && (
            <AddProfileSheet
              key={adding.session}
              open={adding.open}
              onClose={() => setAdding((current) => current && { ...current, open: false })}
              onSubmit={async (payload) => {
                const res = await authFetch<ProfileResponse>("/api/profile", { method: "POST", body: payload });
                // Put the profile into the list first; switching to a profile the cached list lacks resolves back to the picker.
                await append(res.profile);
                switchProfile(res.profile.id);
              }}
            />
          )}
```

- `ProfileNameForm` の import がこのファイルで使われなくなったら消す

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/profile "src/app/u" src/app/dev > /tmp/profile-vitest.txt 2>&1; tail -8 /tmp/profile-vitest.txt`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd dystopia/frontend
git add -A src/modules/profile "src/app/u/[username]/page.tsx" src/app/dev/ui/page.tsx
git commit -s -m "feat(dystopia/frontend): edit a profile and add another profile in side sheets"
```

---

### Task 5: Review cards, detail sheet and writing from the profile

**Files:**
- Create: `dystopia/frontend/src/modules/review/components/ReviewCard.tsx`, `ReviewCard.test.tsx`
- Create: `dystopia/frontend/src/modules/review/components/ReviewDetailSheet.tsx`, `ReviewDetailSheet.test.tsx`
- Create: `dystopia/frontend/src/modules/review/components/ReviewList.tsx`, `ReviewList.test.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewsTab.tsx`
- Create: `dystopia/frontend/src/modules/review/components/ReviewsTab.test.tsx`
- Modify: `dystopia/frontend/src/modules/review/components/ReviewComposer.tsx`, `src/components/ui/identity-link.tsx`, `src/components/ui/entry-edit-form.tsx`
- Modify: `dystopia/frontend/src/components/compose/ComposeToSheet.tsx`
- Modify: `dystopia/frontend/src/app/page.tsx`
- Delete: `dystopia/frontend/src/modules/review/components/ReviewEntryCard.tsx`, `ReviewEntryCard.test.tsx`, `ReviewEntryCard.edit.test.tsx`

**Interfaces:**
- Consumes: `ReviewEntry`（`src/modules/review/types.ts`: `id`・`authorProfileId`・`targetProfileId`・`authorUsername`・`authorAvatarUrl`・`targetUsername`・`targetAvatarUrl`・`rating`・`body`・`hidden`・`createdAt`・`updatedAt`）、`useDeleteReview`・`useHideReview`・`useUnhideReview`・`useUpdateReview`（今の `ReviewEntryCard` が使う形のまま）、`EntryEditForm`、`RatingStars`、`ComposeToSheet`（`initialTarget`）
- Produces:
  - `ReviewCard({ entry: ReviewEntry; variant: "feed" | "target" | "author"; onOpen: (entry: ReviewEntry) => void })`
  - `ReviewDetailSheet({ entry: ReviewEntry; open: boolean; onClose: () => void; onChanged: () => void })`
  - `ReviewList({ entries: ReviewEntry[]; variant; hasMore: boolean; loading: boolean; onLoadMore: () => void; onChanged: () => void; empty: string })`
  - `ReviewsTab` の props に `target?: SocialProfileView`（書かれる側のキャスト。ゲストが見ているときの「レビューを書く」に使う）
  - `ComposeToSheet` の props に `onSaved?: () => void`（保存してトーストを出したあとに呼ぶ）

文言:

| 場所 | 文言 |
|---|---|
| カードの小見出し | REVIEW / ゲストからキャストへ |
| カードのチップ | ゲストによるレビュー |
| 書かれた人から見て非表示中 | 非表示中 |
| カードの枠の外 | キャストのプロフィールを見る → |
| 詳細シートの見出し | レビューの詳細 |
| 詳細シートの小見出し | REVIEW / ゲストからキャスト |
| 詳細シートの宛先の行 | @キャスト へのレビュー · 相対時刻 |
| 編集済み | 編集済み |
| 削除の確認 | このレビューを削除しますか？ |
| トースト（編集・削除・非表示・再表示） | レビューを更新しました / レビューを削除しました / レビューを非表示にしました / レビューを表示に戻しました |
| 書く | レビューを書く |
| 一覧が空 | まだレビューはありません。 |

- [ ] **Step 1: Write the failing tests**

`src/modules/review/components/ReviewCard.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ReviewEntry } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const viewer = vi.hoisted(() => ({ id: "someone" }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: viewer.id }),
}));

const { ReviewCard } = await import("./ReviewCard");

const entry = (overrides: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id: "r-1",
  authorProfileId: "guest-1",
  targetProfileId: "cast-1",
  authorUsername: "hanako",
  authorAvatarUrl: "",
  targetUsername: "yuna",
  targetAvatarUrl: "",
  rating: 4,
  body: "とても丁寧でした",
  hidden: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

async function mount(props: { entry: ReviewEntry; variant: "feed" | "target" | "author"; onOpen?: (e: ReviewEntry) => void }) {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(ReviewCard, { onOpen: vi.fn(), ...props }));
  });
  return container;
}

describe("ReviewCard", () => {
  it("summarizes the review and opens it", async () => {
    const onOpen = vi.fn();
    const subject = entry();
    const container = await mount({ entry: subject, variant: "feed", onOpen });

    expect(container.textContent).toContain("REVIEW / ゲストからキャストへ");
    expect(container.textContent).toContain("@hanako");
    expect(container.textContent).toContain("@yuna");
    expect(container.textContent).toContain("★ 4.0");
    expect(container.textContent).toContain("とても丁寧でした");
    expect(container.textContent).toContain("ゲストによるレビュー");
    expect(container.querySelector('a[href="/u/yuna"]')?.textContent).toBe("キャストのプロフィールを見る →");

    (container.querySelector("button") as HTMLButtonElement).click();
    expect(onOpen).toHaveBeenCalledWith(subject);
  });

  it("leaves out the cast link on the cast's own reviews", async () => {
    const container = await mount({ entry: entry(), variant: "target" });

    expect(container.textContent).not.toContain("キャストのプロフィールを見る");
  });

  it("marks a hidden review only for the cast it is about", async () => {
    viewer.id = "cast-1";
    const forTarget = await mount({ entry: entry({ hidden: true }), variant: "target" });
    viewer.id = "someone";
    const forOthers = await mount({ entry: entry({ hidden: true }), variant: "feed" });

    expect(forTarget.textContent).toContain("非表示中");
    expect(forOthers.textContent).not.toContain("非表示中");
  });
});
```

`src/modules/review/components/ReviewDetailSheet.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewEntry } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  viewer: "guest-1",
  remove: vi.fn(),
  hide: vi.fn(),
  unhide: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: mocks.viewer }),
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));
vi.mock("../hooks/useDeleteReview", () => ({ useDeleteReview: () => ({ remove: mocks.remove, loading: false }) }));
vi.mock("../hooks/useHideReview", () => ({ useHideReview: () => ({ hide: mocks.hide, loading: false }) }));
vi.mock("../hooks/useUnhideReview", () => ({ useUnhideReview: () => ({ unhide: mocks.unhide, loading: false }) }));
vi.mock("../hooks/useUpdateReview", () => ({ useUpdateReview: () => ({ update: mocks.update, loading: false, error: null }) }));

const { ReviewDetailSheet } = await import("./ReviewDetailSheet");

const entry = (overrides: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id: "r-1",
  authorProfileId: "guest-1",
  targetProfileId: "cast-1",
  authorUsername: "hanako",
  authorAvatarUrl: "",
  targetUsername: "yuna",
  targetAvatarUrl: "",
  rating: 4,
  body: "とても丁寧でした",
  hidden: false,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...overrides,
});

let onClose: ReturnType<typeof vi.fn>;
let onChanged: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const fn of [mocks.remove, mocks.hide, mocks.unhide, mocks.update, mocks.toast, mocks.confirm]) fn.mockReset();
  mocks.remove.mockResolvedValue(true);
  mocks.hide.mockResolvedValue(true);
  mocks.unhide.mockResolvedValue(true);
  mocks.update.mockResolvedValue(true);
  mocks.confirm.mockReturnValue(true);
  vi.stubGlobal("confirm", mocks.confirm);
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount(subject: ReviewEntry) {
  onClose = vi.fn();
  onChanged = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(ReviewDetailSheet, { entry: subject, open: true, onClose, onChanged }));
  });
}

const text = () => document.body.textContent ?? "";
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label) as HTMLButtonElement | undefined;
const click = async (label: string) => {
  await act(async () => {
    button(label)!.click();
  });
};

describe("ReviewDetailSheet", () => {
  it("shows the review in full", async () => {
    mocks.viewer = "someone";
    await mount(entry());

    expect(text()).toContain("レビューの詳細");
    expect(text()).toContain("REVIEW / ゲストからキャスト");
    expect(text()).toContain("@hanako");
    expect(text()).toContain("@yuna へのレビュー");
    expect(text()).toContain("とても丁寧でした");
    expect(button("編集")).toBeUndefined();
    expect(button("非表示にする")).toBeUndefined();
  });

  it("lets the author delete after confirming and closes", async () => {
    mocks.viewer = "guest-1";
    await mount(entry());

    await click("削除");

    expect(mocks.confirm).toHaveBeenCalledWith("このレビューを削除しますか？");
    expect(mocks.remove).toHaveBeenCalledWith("r-1");
    expect(mocks.toast).toHaveBeenCalledWith("レビューを削除しました");
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("lets the author edit in the sheet", async () => {
    mocks.viewer = "guest-1";
    await mount(entry());

    await click("編集");

    expect(document.querySelector('[role="dialog"] textarea')).not.toBeNull();
  });

  it("lets the cast hide and show the review again", async () => {
    mocks.viewer = "cast-1";
    await mount(entry());
    await click("非表示にする");
    expect(mocks.hide).toHaveBeenCalledWith("r-1");
    expect(mocks.toast).toHaveBeenCalledWith("レビューを非表示にしました");
    expect(onChanged).toHaveBeenCalled();

    document.body.innerHTML = "";
    await mount(entry({ hidden: true }));
    await click("表示に戻す");
    expect(mocks.unhide).toHaveBeenCalledWith("r-1");
    expect(mocks.toast).toHaveBeenCalledWith("レビューを表示に戻しました");
  });
});
```

（`remove`・`hide`・`unhide` は成功で `true`・失敗で `false` を返し、`update` は成功で更新後の `ReviewEntry`・失敗で `null` を返す。各 hook のファイルのとおり）

`src/modules/review/components/ReviewList.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ReviewEntry } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const opened = vi.hoisted(() => ({ props: null as null | { entry: ReviewEntry; open: boolean; onClose: () => void } }));

vi.mock("./ReviewCard", () => ({
  ReviewCard: ({ entry, onOpen }: { entry: ReviewEntry; onOpen: (e: ReviewEntry) => void }) => (
    <button type="button" onClick={() => onOpen(entry)}>
      card:{entry.id}
    </button>
  ),
}));
vi.mock("./ReviewDetailSheet", () => ({
  ReviewDetailSheet: (props: { entry: ReviewEntry; open: boolean; onClose: () => void }) => {
    opened.props = props;
    return <div>sheet:{props.entry.id}:{String(props.entry.hidden)}:{String(props.open)}</div>;
  },
}));

const { ReviewList } = await import("./ReviewList");

const entry = (id: string, hidden = false) => ({ id, hidden }) as ReviewEntry;

describe("ReviewList", () => {
  it("opens the pressed review and shows its latest state after a refresh", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = (entries: ReviewEntry[]) =>
      act(async () => {
        root.render(
          createElement(ReviewList, {
            entries,
            variant: "feed",
            hasMore: false,
            loading: false,
            onLoadMore: vi.fn(),
            onChanged: vi.fn(),
            empty: "まだレビューはありません。",
          })
        );
      });
    await render([entry("r-1"), entry("r-2")]);

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "card:r-2") as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("sheet:r-2:false:true");

    await render([entry("r-1"), entry("r-2", true)]);
    expect(container.textContent).toContain("sheet:r-2:true:true");

    await act(async () => opened.props!.onClose());
    expect(container.textContent).toContain("sheet:r-2:true:false");
  });

  it("says when there is nothing", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(
        createElement(ReviewList, {
          entries: [], variant: "feed", hasMore: false, loading: false, onLoadMore: vi.fn(), onChanged: vi.fn(), empty: "まだレビューはありません。",
        })
      );
    });

    expect(container.textContent).toContain("まだレビューはありません。");
  });
});
```

`src/modules/review/components/ReviewsTab.test.tsx`:

```tsx
// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { SocialProfileView } from "@/modules/social/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ role: "guest" as "guest" | "cast" }));

const list = { entries: [], hasMore: false, loading: false, loadMore: vi.fn(), refresh: vi.fn() };
vi.mock("../hooks/useReviewsByTarget", () => ({ useReviewsByTarget: () => list }));
vi.mock("../hooks/useReviewsByAuthor", () => ({ useReviewsByAuthor: () => list }));
vi.mock("./ReviewList", () => ({ ReviewList: ({ variant }: { variant: string }) => <div>list:{variant}</div> }));
vi.mock("@/components/compose/ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open, initialTarget }: { kind: string; open: boolean; initialTarget?: SocialProfileView }) => (
    <div>compose:{kind}:{String(open)}:{initialTarget?.profileId}</div>
  ),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string }) => unknown) => selector({ role: mocks.role }),
  selectRole: (state: { role: string }) => state.role,
}));

const { ReviewsTab } = await import("./ReviewsTab");

const cast: SocialProfileView = { profileId: "cast-1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" };

async function mount(mode: "received" | "written") {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(ReviewsTab, { profileId: "cast-1", mode, target: cast }));
  });
  return container;
}

describe("ReviewsTab", () => {
  it("lets a guest write a review for the cast from the cast's tab", async () => {
    mocks.role = "guest";
    const container = await mount("received");

    expect(container.textContent).toContain("list:target");
    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "レビューを書く") as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("compose:review:true:cast-1");
  });

  it("does not offer writing to a cast or on a written list", async () => {
    mocks.role = "cast";
    expect((await mount("received")).textContent).not.toContain("レビューを書く");

    mocks.role = "guest";
    const written = await mount("written");
    expect(written.textContent).not.toContain("レビューを書く");
    expect(written.textContent).toContain("list:author");
  });
});
```

`src/components/compose/ComposeToSheet.test.tsx` の `mount` に `onSaved` を渡せるようにし（`initialTarget` と同じやり方）、`it("confirms a saved karte entry and closes", ...)` の中で `onSaved` が 1 回呼ばれることも確かめる。

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/review src/components/compose > /tmp/profile-vitest.txt 2>&1; tail -15 /tmp/profile-vitest.txt`
Expected: FAIL

- [ ] **Step 3: Implement the card**

`src/modules/review/components/ReviewCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatTimeAgo } from "@/lib/utils/date";
import { useAuthStore } from "@/stores/authStore";
import type { ReviewEntry } from "../types";

export function handle(username: string): string {
  return username ? `@${username}` : "(退会済)";
}

interface ReviewCardProps {
  entry: ReviewEntry;
  variant: "feed" | "target" | "author";
  onOpen: (entry: ReviewEntry) => void;
}

export function ReviewCard({ entry, variant, onOpen }: ReviewCardProps) {
  const viewerId = useAuthStore((s) => s.activeProfileId);
  const hiddenForViewer = entry.hidden && viewerId === entry.targetProfileId;

  return (
    <article className="border-b border-border px-4 py-3">
      <div className="flex gap-3">
        <Avatar src={entry.authorAvatarUrl || undefined} fallback={(entry.authorUsername || "?").slice(0, 1)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold tracking-wide text-text-secondary">REVIEW / ゲストからキャストへ</p>
          <p className="flex min-w-0 items-center gap-1 text-sm">
            <span className="truncate font-bold text-text-primary">{handle(entry.authorUsername)}</span>
            <span className="shrink-0 text-text-secondary">· {formatTimeAgo(entry.createdAt)}</span>
          </p>
          <button
            type="button"
            onClick={() => onOpen(entry)}
            className="mt-2 block w-full rounded-xl border border-border bg-surface p-3 text-left hover:border-accent/60"
          >
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate font-bold text-text-primary">{handle(entry.targetUsername)}</span>
              <span className="shrink-0 text-sm font-bold text-rating">★ {entry.rating.toFixed(1)}</span>
            </span>
            {entry.body && <span className="mt-1 line-clamp-2 block text-sm text-text-primary">{entry.body}</span>}
            <span className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-xs text-accent">ゲストによるレビュー</span>
              {hiddenForViewer && (
                <span className="rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-xs text-warning">非表示中</span>
              )}
            </span>
          </button>
          {variant !== "target" && entry.targetUsername && (
            <Link href={`/u/${encodeURIComponent(entry.targetUsername)}`} className="mt-2 inline-flex min-h-11 items-center text-sm text-accent hover:underline">
              キャストのプロフィールを見る →
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}
```

- [ ] **Step 4: Implement the detail sheet and the list**

`src/modules/review/components/ReviewDetailSheet.tsx`:

```tsx
"use client";

import { useState } from "react";
import { EntryEditForm } from "@/components/ui/entry-edit-form";
import { RatingStars } from "@/components/ui/rating-stars";
import { SideSheet } from "@/components/ui/side-sheet";
import { formatTimeAgo, isEditedAfterCreation } from "@/lib/utils/date";
import { useAuthStore } from "@/stores/authStore";
import { useToastStore } from "@/stores/toastStore";
import { useDeleteReview } from "../hooks/useDeleteReview";
import { useHideReview } from "../hooks/useHideReview";
import { useUnhideReview } from "../hooks/useUnhideReview";
import { useUpdateReview } from "../hooks/useUpdateReview";
import type { ReviewEntry } from "../types";
import { handle } from "./ReviewCard";

interface ReviewDetailSheetProps {
  entry: ReviewEntry;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const ACTION = "min-h-11 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50";

export function ReviewDetailSheet({ entry, open, onClose, onChanged }: ReviewDetailSheetProps) {
  const viewerId = useAuthStore((s) => s.activeProfileId);
  const isAuthor = viewerId === entry.authorProfileId;
  const isTarget = viewerId === entry.targetProfileId;
  const showToast = useToastStore((s) => s.show);
  const { remove, loading: deleting } = useDeleteReview();
  const { hide, loading: hiding } = useHideReview();
  const { unhide, loading: unhiding } = useUnhideReview();
  const { update, loading: updating, error: updateError } = useUpdateReview();
  const [editing, setEditing] = useState(false);

  const after = (succeeded: unknown, message: string) => {
    onChanged();
    if (succeeded) showToast(message);
    return succeeded;
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="レビューの詳細"
    >
      <div className="flex flex-col gap-4">
        <p className="text-xs font-bold tracking-wide text-text-secondary">REVIEW / ゲストからキャスト</p>
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="font-bold text-text-primary">{handle(entry.authorUsername)}</p>
          <p className="text-xs text-text-secondary">
            {handle(entry.targetUsername)} へのレビュー · {formatTimeAgo(entry.createdAt)}
          </p>
        </div>
        {editing ? (
          <EntryEditForm
            initialRating={entry.rating}
            initialBody={entry.body}
            saving={updating}
            error={updateError?.message}
            onCancel={() => setEditing(false)}
            onSave={async (rating, body) => {
              if (!after(await update(entry.id, rating, body), "レビューを更新しました")) return;
              setEditing(false);
            }}
          />
        ) : (
          <>
            <div className="flex items-center gap-2">
              <RatingStars value={entry.rating} className="text-3xl" />
              {isEditedAfterCreation(entry.createdAt, entry.updatedAt) && <span className="text-xs text-text-secondary">編集済み</span>}
            </div>
            {entry.body && <p className="whitespace-pre-wrap text-text-primary">{entry.body}</p>}
          </>
        )}
        {(isAuthor || isTarget) && !editing && (
          <div className="flex gap-4 border-t border-divider pt-3">
            {isAuthor && (
              <button type="button" onClick={() => setEditing(true)} className={ACTION}>
                編集
              </button>
            )}
            {isAuthor && (
              <button
                type="button"
                disabled={deleting}
                onClick={async () => {
                  if (!confirm("このレビューを削除しますか？")) return;
                  if (after(await remove(entry.id), "レビューを削除しました")) onClose();
                }}
                className={ACTION}
              >
                削除
              </button>
            )}
            {isTarget &&
              (entry.hidden ? (
                <button type="button" disabled={unhiding} onClick={async () => after(await unhide(entry.id), "レビューを表示に戻しました")} className={ACTION}>
                  表示に戻す
                </button>
              ) : (
                <button type="button" disabled={hiding} onClick={async () => after(await hide(entry.id), "レビューを非表示にしました")} className={ACTION}>
                  非表示にする
                </button>
              ))}
          </div>
        )}
      </div>
    </SideSheet>
  );
}
```


`src/modules/review/components/ReviewList.tsx`:

```tsx
"use client";

import { useCallback, useState } from "react";
import type { ReviewEntry } from "../types";
import { ReviewCard } from "./ReviewCard";
import { ReviewDetailSheet } from "./ReviewDetailSheet";

interface Opened {
  entry: ReviewEntry;
  session: number;
  open: boolean;
}

interface ReviewListProps {
  entries: ReviewEntry[];
  variant: "feed" | "target" | "author";
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onChanged: () => void;
  empty: string;
}

export function ReviewList({ entries, variant, hasMore, loading, onLoadMore, onChanged, empty }: ReviewListProps) {
  // Keep the opened review after closing: dropping it would unmount the sheet before it slides out.
  const [opened, setOpened] = useState<Opened | null>(null);
  const close = useCallback(() => setOpened((current) => current && { ...current, open: false }), []);
  const current = opened ? (entries.find((e) => e.id === opened.entry.id) ?? opened.entry) : null;

  return (
    <div>
      {entries.map((entry) => (
        <ReviewCard
          key={entry.id}
          entry={entry}
          variant={variant}
          onOpen={(chosen) => setOpened((previous) => ({ entry: chosen, session: (previous?.session ?? 0) + 1, open: true }))}
        />
      ))}
      {!loading && entries.length === 0 && <p className="px-4 py-8 text-center text-sm text-text-secondary">{empty}</p>}
      {loading && entries.length === 0 && <p className="px-4 py-3 text-sm text-text-secondary">読み込み中…</p>}
      {hasMore && (
        <button
          type="button"
          onClick={onLoadMore}
          disabled={loading}
          className="block w-full px-4 py-3 text-sm text-text-secondary hover:text-text-primary disabled:opacity-50"
        >
          もっと見る
        </button>
      )}
      {opened && current && (
        <ReviewDetailSheet key={opened.session} entry={current} open={opened.open} onClose={close} onChanged={onChanged} />
      )}
    </div>
  );
}
```

- [ ] **Step 5: Use the list in the tab and on home, and write from the profile**

`src/components/compose/ComposeToSheet.tsx`: `ComposeToSheetProps` に `onSaved?: () => void;` を足し、引数に `onSaved` を足し、`saved` を次に替える:

```tsx
  const saved = () => {
    if (kind !== "message") showToast(SAVED_MESSAGE[kind]);
    onSaved?.();
    onClose();
  };
```

`src/modules/review/components/ReviewsTab.tsx` を次に替える:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ComposeToSheet } from "@/components/compose/ComposeToSheet";
import type { SocialProfileView } from "@/modules/social/types";
import { useAuthStore, selectRole } from "@/stores/authStore";
import { useReviewsByAuthor } from "../hooks/useReviewsByAuthor";
import { useReviewsByTarget } from "../hooks/useReviewsByTarget";
import { ReviewList } from "./ReviewList";

interface Props {
  profileId: string;
  mode: "received" | "written";
  target?: SocialProfileView;
}

export function ReviewsTab({ profileId, mode, target }: Props) {
  const viewerRole = useAuthStore(selectRole);
  const byTarget = useReviewsByTarget(mode === "received" ? profileId : null);
  const byAuthor = useReviewsByAuthor(mode === "written" ? profileId : null);
  const { entries, hasMore, loading, loadMore, refresh } = mode === "received" ? byTarget : byAuthor;
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [composing, setComposing] = useState<{ session: number; open: boolean } | null>(null);
  const canWrite = mode === "received" && viewerRole === "guest" && !!target;

  return (
    <div>
      <ReviewList
        entries={entries}
        variant={mode === "received" ? "target" : "author"}
        hasMore={hasMore}
        loading={loading}
        onLoadMore={loadMore}
        onChanged={refresh}
        empty="まだレビューはありません。"
      />
      {canWrite && (
        <div className="px-4 py-4">
          <Button
            type="button"
            className="w-full"
            onClick={() => setComposing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
          >
            レビューを書く
          </Button>
        </div>
      )}
      {composing && target && (
        <ComposeToSheet
          key={composing.session}
          kind="review"
          open={composing.open}
          initialTarget={target}
          onSaved={refresh}
          onClose={() => setComposing((current) => current && { ...current, open: false })}
        />
      )}
    </div>
  );
}
```

`src/app/u/[username]/page.tsx` のキャストのレビュータブ（Task 3 で `leadingTabs` に入れたもの）に、キャストの `SocialProfileView` を `target` として渡す:

```tsx
                {
                  id: "reviews",
                  label: "レビュー",
                  content: (
                    <ReviewsTab
                      profileId={profile.id}
                      mode="received"
                      target={{ ...guestView, role: "cast" }}
                    />
                  ),
                },
```

（`guestView` は役割以外の項目がこのプロフィールのもの。役割だけ `cast` に替えて渡す）

`src/app/page.tsx` の `reviewsContent` の、`reviews.entries.map((e) => <ReviewEntryCard .../>)` から「もっと見る」までを次に替える:

```tsx
        <ReviewList
          entries={reviews.entries}
          variant="feed"
          hasMore={reviews.hasMore}
          loading={reviews.loading}
          onLoadMore={() => reviews.loadMore()}
          onChanged={reviews.refresh}
          empty="まだレビューがありません"
        />
```

`ReviewEntryCard` の import を `import { ReviewList } from "@/modules/review/components/ReviewList";` に替える。使われなくなった import（`Button` など）は、ファイル内で使われていなければ消す。

`ReviewEntryCard.tsx`・`ReviewEntryCard.test.tsx`・`ReviewEntryCard.edit.test.tsx` を `git rm` し、`grep -rn "ReviewEntryCard" src` が 0 件になることを確かめる。

- [ ] **Step 6: Replace the undefined classes**

| ファイル | 置き換え |
|---|---|
| `src/modules/review/components/ReviewComposer.tsx` | `text-muted-foreground` → `text-text-secondary`、`text-red-600` → `text-error`、`bg-accent ... text-accent-foreground` → `bg-accent ... text-white` |
| `src/components/ui/identity-link.tsx` | `bg-muted` → `bg-surface` |
| `src/components/ui/entry-edit-form.tsx` | `text-muted-foreground` → `text-text-secondary`、`hover:text-foreground` → `hover:text-text-primary` |

置き換え後、`grep -rnE "text-muted-foreground|text-foreground|bg-muted\\b|text-accent-foreground|text-red-600" src/modules/review src/components/ui/identity-link.tsx src/components/ui/entry-edit-form.tsx` が 0 件になること。

- [ ] **Step 7: Run the tests to verify they pass**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/review src/components "src/app" > /tmp/profile-vitest.txt 2>&1; tail -8 /tmp/profile-vitest.txt`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
cd dystopia/frontend
git add -A src/modules/review src/components/compose src/components/ui/identity-link.tsx src/components/ui/entry-edit-form.tsx src/app/page.tsx "src/app/u/[username]/page.tsx"
git commit -s -m "feat(dystopia/frontend): show reviews as summary cards with a detail sheet and write one from a cast's profile"
```

---

### Task 6: Close the post sheet on a same-path query change

**Files:**
- Modify: `dystopia/frontend/src/modules/post/components/PostDetailSheet.tsx`
- Test: `dystopia/frontend/src/modules/post/components/PostDetailSheet.test.tsx`

**Interfaces:**
- Consumes: 4a の `PostDetailSheet` の `navigate`（`SheetNavigationContext` に渡している関数）

- [ ] **Step 1: Write the failing test**

`PostDetailSheet.test.tsx` の `PostDetailContent` の mock が出すリンクに `<a href="/?q=tag">query</a>` を足す（今の場所は `/`。既存の `here` と同じパス）。`describe("links inside the sheet", ...)` の中に足す:

```tsx
    it("replaces and closes when only the query changes", async () => {
      await clickLink("query");

      expect(router.replace).toHaveBeenCalledWith("/?q=tag");
      expect(usePostSheetStore.getState().open).toBe(false);
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/post/components/PostDetailSheet.test.tsx > /tmp/profile-vitest.txt 2>&1; tail -10 /tmp/profile-vitest.txt`
Expected: FAIL（`open` が `true` のまま）

- [ ] **Step 3: Implement**

`PostDetailSheet.tsx` の `navigate` を次に替える:

```tsx
  // The sheet closes on a pathname change, so it is closed here when the target keeps the current pathname.
  const navigate = useCallback(
    (href: string) => {
      const target = new URL(href, window.location.href);
      const samePath = target.pathname === window.location.pathname;
      if (!samePath || target.search !== window.location.search) router.replace(target.pathname + target.search + target.hash);
      if (samePath) close();
    },
    [close, router]
  );
```

（直前の 1 行コメントは上のものに置き換える）

- [ ] **Step 4: Run the post tests to verify they pass**

Run: `cd dystopia/frontend && env -u NODE_OPTIONS pnpm exec vitest run src/modules/post > /tmp/profile-vitest.txt 2>&1; tail -8 /tmp/profile-vitest.txt`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd dystopia/frontend
git add src/modules/post/components/PostDetailSheet.tsx src/modules/post/components/PostDetailSheet.test.tsx
git commit -s -m "fix(dystopia/frontend): close the post sheet when a link inside it only changes the query"
```

---

### Task 7: Whole-branch verification

**Files:** なし（検証と PR）

- [ ] **Step 1: Run the frontend checks and the production build**

Run:

```bash
cd dystopia/frontend
env -u NODE_OPTIONS pnpm exec vitest run > /tmp/profile-vitest.txt 2>&1; tail -6 /tmp/profile-vitest.txt
env -u NODE_OPTIONS pnpm exec tsc --noEmit; echo "tsc exit $?"
env -u NODE_OPTIONS pnpm exec next build > /tmp/profile-build.txt 2>&1; echo "build exit $?"
```

Expected: vitest 全件通過、`tsc exit 0`、`build exit 0`

- [ ] **Step 2: Check the scope**

Run: `git diff --stat feat/dystopia-post-screens...HEAD` と `git status --short`
Expected: `src/app/api`・`src/stub`・`proto`・`dystopia/monolith` が含まれない。作業ツリーが clean

- [ ] **Step 3: Check on a real browser**

使い捨て DB を作り、monolith と frontend を起動する（メモリ `reference_local_e2e_run.md`）。次を確かめる。

| 操作 | 期待 |
|---|---|
| キャスト（`+819000000101`）で自分のプロフィールを開く | タブが 投稿・出勤・レビュー・返信・メディア・いいね の順。上に「今週の出勤」。チップ「キャスト」とエリア |
| 「もっと見る →」 | 出勤タブに切り替わり、「今週の出勤」が消える。7 日の表示と「出勤情報は予約可能枠を保証するものではありません。」 |
| 「まとめて編集」で 3 日を選び、20:00〜02:00 で反映 | トースト「出勤予定を更新しました」、シートが閉じ、出勤タブに 3 日分が出る |
| 同じ 3 日のうち 1 日を「予定を消す」で反映 | その日が「未設定」になる |
| 「プロフィールを編集」 | 右からシート。「○○として編集中」。自己紹介を変えて保存すると上部に反映 |
| 設定の人格の管理で「プロフィールを追加」 | 右からシート「プロフィールを追加」。追加すると新しい人格に切り替わる |
| ゲスト（`+819000000104`）でキャストのプロフィールのレビュータブ | 「レビューを書く」で相手を選び済みの作成シート。投稿するとトーストと一覧に出る |
| レビューのカードを押す | 右から「レビューの詳細」。書いた人には「編集」「削除」 |
| キャストで自分のレビュータブのカードを開き「非表示にする」 | トースト「レビューを非表示にしました」、カードに「非表示中」 |
| ホームのレビュータブ | 新しいカードで出る |
| 検索ページの上で投稿詳細シートを開き、本文のハッシュタグを押す | 検索の結果が変わり、シートが閉じる |

monolith と frontend のログに ERROR がないことを確かめる。確認後、サーバーを止め、使い捨て DB を削除し、`dystopia/frontend/AGENTS.md`・`CLAUDE.md` が生成されていれば消す。

- [ ] **Step 4: Push and open the draft PR**

```bash
git push -u origin HEAD
gh pr create --draft --base feat/dystopia-post-screens --title "feat(dystopia): rebuild the profile screens with shift and review sheets" --body-file <説明のファイル>
gh stack link 1521 1542 1544 1545 <この PR の番号>
```

PR の説明には、Why（#1517 の第 4 段の 4b）、Decisions（spec の表）、検証（Step 1〜3 のコマンドと結果）、`Refs #1517` を書く。PR は Draft のままにする。
