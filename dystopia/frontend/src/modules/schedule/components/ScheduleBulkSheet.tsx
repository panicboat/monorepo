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
