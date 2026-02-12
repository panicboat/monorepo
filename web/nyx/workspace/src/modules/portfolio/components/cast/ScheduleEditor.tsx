"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Plus, Trash2 } from "lucide-react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  startOfDay,
  isBefore,
} from "date-fns";
import { ja } from "date-fns/locale";
import { WeeklySchedule } from "@/modules/portfolio/types";

interface ScheduleEditorProps {
  schedules: WeeklySchedule[];
  onChange: (schedules: WeeklySchedule[]) => void;
  defaultStart?: string;
  defaultEnd?: string;
}

export const ScheduleEditor = ({
  schedules,
  onChange,
  defaultStart = "18:00",
  defaultEnd = "23:00",
}: ScheduleEditorProps) => {
  const [viewStartDate, setViewStartDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const today = startOfDay(new Date());

  const days = Array.from({ length: 7 }, (_, i) => addDays(viewStartDate, i));
  const weekLabel = `${format(viewStartDate, "M/d", { locale: ja })} - ${format(endOfWeek(viewStartDate, { weekStartsOn: 1 }), "M/d", { locale: ja })}`;

  const goToPrevWeek = () => {
    const newDate = addDays(viewStartDate, -7);
    if (newDate < startOfWeek(new Date(), { weekStartsOn: 1 })) return;
    setViewStartDate(newDate);
  };

  const goToNextWeek = () => setViewStartDate(addDays(viewStartDate, 7));

  const addSchedule = (dateStr: string) => {
    const newSchedule: WeeklySchedule = {
      date: dateStr,
      start: defaultStart,
      end: defaultEnd,
    };
    onChange([...schedules, newSchedule]);
  };

  const updateSchedule = (
    index: number,
    field: keyof WeeklySchedule,
    value: string
  ) => {
    const newSchedules = [...schedules];
    newSchedules[index] = { ...newSchedules[index], [field]: value };
    onChange(newSchedules);
  };

  const removeSchedule = (index: number) => {
    const newSchedules = schedules.filter((_, i) => i !== index);
    onChange(newSchedules);
  };

  return (
    <div className="space-y-4">
      {/* Week Pagination */}
      <div className="flex items-center justify-between rounded-xl bg-surface-secondary p-2">
        <button
          type="button"
          onClick={goToPrevWeek}
          disabled={
            viewStartDate <= startOfWeek(new Date(), { weekStartsOn: 1 })
          }
          className="rounded-lg p-2 text-text-secondary hover:bg-surface hover:text-role-cast disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="font-bold text-text-secondary">{weekLabel}</div>
        <button
          type="button"
          onClick={goToNextWeek}
          className="rounded-lg p-2 text-text-secondary hover:bg-surface hover:text-role-cast transition-colors"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {days.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const isPast = isBefore(date, today);
        const daySchedules = schedules
          .map((s, i) => ({ ...s, originalIndex: i }))
          .filter((s) => s.date === dateStr);
        const dayLabel = format(date, "M/d (E)", { locale: ja });
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        return (
          <div
            key={dateStr}
            className={`rounded-xl border p-4 transition-all ${
              isPast
                ? "border-border bg-surface-secondary opacity-60"
                : daySchedules.length > 0
                  ? "border-role-cast-light bg-role-cast-lighter/30"
                  : "border-border bg-surface"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-sm font-bold ${
                  isPast
                    ? "text-text-muted"
                    : isWeekend
                      ? "text-role-cast"
                      : "text-text-secondary"
                }`}
              >
                {dayLabel}{" "}
                {isPast && (
                  <span className="text-[10px] font-normal">(ended)</span>
                )}
              </span>
              {!isPast && (
                <button
                  type="button"
                  onClick={() => addSchedule(dateStr)}
                  className="flex items-center gap-1 rounded-lg bg-role-cast-lighter px-3 py-1.5 text-xs font-bold text-role-cast transition-colors hover:bg-role-cast-light hover:text-role-cast-hover border border-role-cast-light"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              )}
            </div>

            {daySchedules.length === 0 ? (
              <div className="text-xs text-text-muted text-center py-2">
                {isPast ? "Ended" : "No schedule"}
              </div>
            ) : (
              <div className="space-y-2">
                {daySchedules.map((schedule) => (
                  <div
                    key={schedule.originalIndex}
                    className="flex items-center gap-2 rounded-lg bg-surface border border-border p-2 shadow-sm"
                  >
                    <Clock size={14} className="text-text-muted shrink-0" />
                    <input
                      type="time"
                      value={schedule.start}
                      disabled={isPast}
                      onChange={(e) =>
                        updateSchedule(
                          schedule.originalIndex,
                          "start",
                          e.target.value
                        )
                      }
                      className="bg-transparent font-bold text-text-secondary focus:outline-none disabled:text-text-muted text-sm border border-border rounded px-2 py-1 w-24"
                    />
                    <span className="text-text-muted">-</span>
                    <input
                      type="time"
                      value={schedule.end}
                      disabled={isPast}
                      onChange={(e) =>
                        updateSchedule(
                          schedule.originalIndex,
                          "end",
                          e.target.value
                        )
                      }
                      className="bg-transparent font-bold text-text-secondary focus:outline-none disabled:text-text-muted text-sm border border-border rounded px-2 py-1 w-24"
                    />
                    {!isPast && (
                      <button
                        type="button"
                        onClick={() => removeSchedule(schedule.originalIndex)}
                        className="ml-auto rounded-lg p-1.5 text-text-muted hover:bg-error-lighter hover:text-error transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
