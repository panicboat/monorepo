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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/Select";

export type ScheduleItem = {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  planId?: string; // Optional link to a specific plan
};

export type SchedulePlan = {
  id: string;
  name: string;
  duration: number; // minutes
  price?: number; // yen
};

interface WeeklyScheduleInputProps {
  schedules: ScheduleItem[];
  plans?: SchedulePlan[]; // Available plans to link
  onChange: (schedules: ScheduleItem[]) => void;
  defaultStart?: string; // Default start time from profile
  defaultEnd?: string; // Default end time from profile
}

const getDuration = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return endMins - startMins;
};

export const WeeklyScheduleInput = ({
  schedules,
  plans = [],
  onChange,
  defaultStart = "09:00",
  defaultEnd = "21:00",
}: WeeklyScheduleInputProps) => {
  const [viewStartDate, setViewStartDate] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 }),
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
    const newSchedule: ScheduleItem = {
      date: dateStr,
      start: defaultStart,
      end: defaultEnd,
      planId: "",
    };
    onChange([...schedules, newSchedule]);
  };

  const updateSchedule = (index: number, field: keyof ScheduleItem, value: string) => {
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
      <div className="flex items-center justify-between rounded-xl bg-slate-100 p-2">
        <button
          type="button"
          onClick={goToPrevWeek}
          disabled={
            viewStartDate <= startOfWeek(new Date(), { weekStartsOn: 1 })
          }
          className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-pink-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="font-bold text-slate-700">{weekLabel}</div>
        <button
          type="button"
          onClick={goToNextWeek}
          className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-pink-600 transition-colors"
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
            className={`rounded-xl border p-4 transition-all ${isPast
              ? "border-slate-100 bg-slate-50 opacity-60"
              : daySchedules.length > 0
                ? "border-pink-200 bg-pink-50/30"
                : "border-slate-100 bg-white"
              }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-sm font-bold ${isPast
                  ? "text-slate-400"
                  : isWeekend
                    ? "text-pink-600"
                    : "text-slate-700"
                  }`}
              >
                {dayLabel}{" "}
                {isPast && (
                  <span className="text-[10px] font-normal">(終了)</span>
                )}
              </span>
              {!isPast && (
                <button
                  type="button"
                  onClick={() => addSchedule(dateStr)}
                  className="flex items-center gap-1 rounded-lg bg-pink-50 px-3 py-1.5 text-xs font-bold text-pink-600 transition-colors hover:bg-pink-100 hover:text-pink-700 border border-pink-100"
                >
                  <Plus size={14} />
                  <span>Add Schedule</span>
                </button>
              )}
            </div>

            {daySchedules.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-2">
                {isPast ? "受付終了" : "No schedule (お休み)"}
              </div>
            ) : (
              <div className="space-y-2">
                {daySchedules.map((schedule, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-lg bg-white border border-slate-200 p-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        <input
                          type="time"
                          value={schedule.start}
                          disabled={isPast}
                          onChange={(e) =>
                            updateSchedule(
                              schedule.originalIndex,
                              "start",
                              e.target.value,
                            )
                          }
                          className="bg-transparent font-bold text-slate-700 focus:outline-none disabled:text-slate-400 text-sm border border-slate-200 rounded px-2 py-1"
                        />
                        <span className="text-slate-400">-</span>
                        <input
                          type="time"
                          value={schedule.end}
                          disabled={isPast}
                          onChange={(e) =>
                            updateSchedule(
                              schedule.originalIndex,
                              "end",
                              e.target.value,
                            )
                          }
                          className="bg-transparent font-bold text-slate-700 focus:outline-none disabled:text-slate-400 text-sm border border-slate-200 rounded px-2 py-1"
                        />
                      </div>
                      {!isPast && (
                        <button
                          type="button"
                          onClick={() => removeSchedule(schedule.originalIndex)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {/* Plan Selector (Optional) */}
                    {plans.length > 0 && !isPast && (
                      <div className="flex flex-col gap-1 border-t border-slate-100 pt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase shrink-0">
                            Plan
                          </span>
                          <Select
                            value={schedule.planId || ""}
                            onValueChange={(val) =>
                              updateSchedule(
                                schedule.originalIndex,
                                "planId",
                                val,
                              )
                            }
                          >
                            <SelectTrigger className="flex-1 h-9 text-sm">
                              <span className="truncate">
                                {schedule.planId
                                  ? (() => {
                                      const p = plans.find(pl => pl.id === schedule.planId);
                                      return p ? `${p.name} (${p.duration}分)` : "プランを選択";
                                    })()
                                  : "All Plans"}
                              </span>
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              <SelectItem value="" className="py-2">
                                <span className="font-medium">All Plans</span>
                              </SelectItem>
                              {plans.map((p) => (
                                <SelectItem key={p.id} value={p.id} className="py-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{p.name}</span>
                                    <span className="text-xs text-slate-500">
                                      {p.duration}分 / ¥{p.price?.toLocaleString()}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {(() => {
                          const selectedPlan = plans.find(
                            (p) => p.id === schedule.planId,
                          );
                          if (!selectedPlan) return null;
                          const scheduleMins = getDuration(schedule.start, schedule.end);
                          if (scheduleMins <= 0) return null;
                          const maxCount = Math.floor(
                            scheduleMins / selectedPlan.duration,
                          );

                          return (
                            <div className="text-xs text-right text-slate-400">
                              このプランなら最大{" "}
                              <span className="font-bold text-pink-500">
                                {Math.max(0, maxCount)}
                              </span>{" "}
                              本
                            </div>
                          );
                        })()}
                      </div>
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
