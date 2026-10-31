"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { SideSheet } from "@/components/ui/side-sheet";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { AppError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { useDeleteSchedule, useSaveSchedule, useSchedules } from "@/modules/schedule/hooks";
import { buildDateRangeThroughNextMonth, crossesMidnight, formatMonthDay } from "@/modules/schedule/lib/dates";
import type { ScheduleAnnouncement } from "@/modules/schedule/types";
import { useToastStore } from "@/stores/toastStore";
import { ScheduleMonthCalendar } from "./ScheduleMonthCalendar";
import { TimeSelect } from "./TimeSelect";

const DEFAULT_ANNOUNCE_TIME = "09:00";
const MAX_ANNOUNCE_NOTE_LENGTH = 200;

type Mode = "work" | "clear";

// A schedule that crosses midnight ends after the work date, so any announcement time on the work date precedes it.
const announcesAfterEnd = (start: string, end: string, announceTime: string) => !crossesMidnight(start, end) && announceTime >= end;

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
  const days = useMemo(() => buildDateRangeThroughNextMonth(new Date()), []);
  const { schedules, loading, error, refresh } = useSchedules(profileId, days[0], days[days.length - 1]);
  const saveSchedule = useSaveSchedule();
  const deleteSchedule = useDeleteSchedule();
  const showToast = useToastStore((s) => s.show);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [mode, setMode] = useState<Mode>("work");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [announce, setAnnounce] = useState(true);
  const [announceTime, setAnnounceTime] = useState(DEFAULT_ANNOUNCE_TIME);
  const [announceNote, setAnnounceNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [failureReasons, setFailureReasons] = useState<string[]>([]);

  const byDate = new Map(schedules.map((s) => [s.workDate, s]));
  const hasPlanSelected = [...selected].some((dateKey) => byDate.has(dateKey));
  const announceTooLate = announce && start !== "" && end !== "" && announceTime !== "" && announcesAfterEnd(start, end, announceTime);
  const ready =
    !loading &&
    !error &&
    (mode === "clear"
      ? hasPlanSelected
      : selected.size > 0 && start !== "" && end !== "" && (!announce || announceTime !== "") && !announceTooLate);

  const toggle = (dateKey: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });

  const apply = async () => {
    setSaving(true);
    setFailed([]);
    setFailureReasons([]);
    const failures: string[] = [];
    const reasons = new Set<string>();
    const announcement: ScheduleAnnouncement = announce
      ? { announce: true, announceTime, announceNote }
      : { announce: false, announceTime: "", announceNote: "" };
    for (const dateKey of days.filter((key) => selected.has(key))) {
      if (mode === "clear" && !byDate.has(dateKey)) continue;
      try {
        if (mode === "work") await saveSchedule(dateKey, start, end, announcement);
        else await deleteSchedule(dateKey);
      } catch (e) {
        failures.push(dateKey);
        if (e instanceof AppError && e.code === "VALIDATION") reasons.add(e.message);
      }
    }
    setSaving(false);
    refresh();
    onSaved();
    if (failures.length === 0) {
      showToast("予定を更新しました");
      onClose();
      return;
    }
    setFailed(failures);
    setFailureReasons([...reasons]);
    setSelected(new Set(failures));
  };

  return (
    <SideSheet
      open={open}
      onOpenChange={(next) => {
        if (!next && !saving) onClose();
      }}
      title="予定を編集"
    >
      <div className="flex flex-col gap-5">
        <ScheduleMonthCalendar days={days} selected={selected} plans={byDate} onToggle={toggle} />

        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex gap-2">
            <button type="button" aria-pressed={mode === "work"} onClick={() => setMode("work")} className={chipClass(mode === "work")}>
              予定を入れる
            </button>
            <button type="button" aria-pressed={mode === "clear"} onClick={() => setMode("clear")} className={chipClass(mode === "clear")}>
              予定を消す
            </button>
          </div>
          {mode === "work" && (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="w-8 shrink-0">開始</span>
                <TimeSelect label="開始" value={start} onChange={setStart} />
              </div>
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="w-8 shrink-0">終了</span>
                <TimeSelect label="終了" value={end} onChange={setEnd} />
              </div>
              <div className="flex flex-col gap-3 border-t border-divider pt-3">
                <label className="flex items-center gap-2 text-sm text-text-primary">
                  <Toggle checked={announce} onCheckedChange={setAnnounce} aria-label="投稿でお知らせする" />
                  <span>投稿でお知らせする</span>
                </label>
                {hasPlanSelected && (
                  <p className="text-sm text-text-secondary">
                    {announce ? "保存済みのお知らせの投稿は、この時刻とひとことで書き換わります" : "保存済みのお知らせの投稿は消えます"}
                  </p>
                )}
                {announce && (
                  <>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3 text-sm text-text-secondary">
                        <span className="shrink-0">お知らせする時刻</span>
                        <TimeSelect label="お知らせする時刻" value={announceTime} onChange={setAnnounceTime} />
                      </div>
                      {announceTooLate && <p className="text-sm text-error">お知らせの時刻は予定の終了より前にしてください</p>}
                    </div>
                    <label className="flex flex-col gap-1 text-sm text-text-secondary">
                      ひとこと
                      <Textarea
                        aria-label="ひとこと"
                        value={announceNote}
                        maxLength={MAX_ANNOUNCE_NOTE_LENGTH}
                        className="min-h-16"
                        onChange={(e) => setAnnounceNote(e.target.value)}
                      />
                    </label>
                  </>
                )}
              </div>
            </div>
          )}
          {mode === "clear" && <p className="mt-3 text-sm text-text-secondary">お知らせの投稿も消えます</p>}
        </div>

        {failed.length > 0 && (
          <p className="text-sm text-error" role="alert">
            {`保存できなかった日があります: ${failed.map(formatMonthDay).join(", ")}`}
            {failureReasons.length > 0 && `（${failureReasons.join("、")}）`}
          </p>
        )}
        <div className="sticky bottom-0 -mx-4 -mb-8 flex items-center justify-between gap-3 border-t border-divider bg-bg-elevated px-4 py-3 md:-mx-5 md:px-5">
          <p className="text-sm font-bold text-text-primary">選択した日：{selected.size}日</p>
          <Button type="button" disabled={!ready || saving} onClick={() => void apply()}>
            選択した日に反映
          </Button>
        </div>
      </div>
    </SideSheet>
  );
}
