"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSchedules, useSaveSchedule, useDeleteSchedule } from "@/modules/schedule/hooks";
import { formatDayLabel, buildDateRange } from "@/modules/schedule/lib/dates";
import { TimeSelect } from "./TimeSelect";

interface ScheduleSectionProps {
  profileId: string;
  isOwner: boolean;
}

const COLLAPSED_DAYS = 3;
const EXPANDED_DAYS = 14;

export function ScheduleSection({ profileId, isOwner }: ScheduleSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  const today = new Date();
  const days = buildDateRange(today, expanded ? EXPANDED_DAYS : COLLAPSED_DAYS);
  const fromDate = days[0];
  const toDate = days[days.length - 1];

  const { schedules, loading, refresh } = useSchedules(profileId || null, fromDate, toDate);
  const saveSchedule = useSaveSchedule();
  const deleteSchedule = useDeleteSchedule();

  if (loading) return null;

  const byDate = new Map(schedules.map((s) => [s.workDate, s]));

  const startEdit = (dateKey: string) => {
    const scheduled = [...schedules].sort((a, b) => a.workDate.localeCompare(b.workDate));
    // FALLBACK: Start an unscheduled day from the closest earlier scheduled day, or the earliest one shown.
    const template = byDate.get(dateKey) ?? scheduled.findLast((s) => s.workDate < dateKey) ?? scheduled[0];
    setEditingDate(dateKey);
    setStartInput(template?.startTime || "");
    setEndInput(template?.endTime || "");
  };

  const handleSave = async () => {
    if (!editingDate) return;
    await saveSchedule(editingDate, startInput, endInput);
    setEditingDate(null);
    refresh();
  };

  const handleClear = async () => {
    if (!editingDate) return;
    await deleteSchedule(editingDate);
    setEditingDate(null);
    refresh();
  };

  return (
    <div className="mt-4 flex flex-col gap-2 border-t border-divider px-4 py-4">
      <h2 className="text-sm font-bold text-text-primary">出勤スケジュール</h2>
      <ul className="flex flex-col gap-1">
        {days.map((dateKey) => {
          const entry = byDate.get(dateKey);
          return (
            <li key={dateKey}>
              <button
                type="button"
                disabled={!isOwner}
                onClick={() => isOwner && startEdit(dateKey)}
                className="grid w-full grid-cols-[5rem_1fr] items-center gap-2 text-left text-sm disabled:cursor-default"
              >
                <span className="text-text-secondary">{formatDayLabel(dateKey)}</span>
                <span className={entry ? "text-text-primary" : "text-text-secondary"}>
                  {entry ? `${entry.startTime} - ${entry.endTime}` : "-"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="text-sm text-accent hover:underline"
        >
          もっと見る
        </button>
      )}
      {editingDate && (
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3">
          <p className="text-sm text-text-secondary">{formatDayLabel(editingDate)} の出勤予定</p>
          <div className="flex items-center gap-2">
            <TimeSelect label="開始時刻" value={startInput} onChange={setStartInput} />
            <span className="text-text-secondary">-</span>
            <TimeSelect label="終了時刻" value={endInput} onChange={setEndInput} />
          </div>
          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={handleSave} disabled={!startInput || !endInput}>
              保存
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClear}>
              休みにする
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditingDate(null)}>
              キャンセル
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
