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

export type Shift = {
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end: string; // HH:mm
  planId?: string; // Optional link to a specific plan
};

export type SimplePlan = {
  id: string;
  name: string;
  duration: number; // minutes
};

interface WeeklyShiftInputProps {
  shifts: Shift[];
  plans?: SimplePlan[]; // Available plans to link
  onChange: (shifts: Shift[]) => void;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

const getDuration = (start: string, end: string) => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return endMins - startMins;
};

export const WeeklyShiftInput = ({
  shifts,
  plans = [],
  onChange,
}: WeeklyShiftInputProps) => {
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

  const addShift = (dateStr: string) => {
    // Default shift: 18:00 - 23:00
    const newShift: Shift = {
      date: dateStr,
      start: "18:00",
      end: "23:00",
      planId: "",
    };
    onChange([...shifts, newShift]);
  };

  const updateShift = (index: number, field: keyof Shift, value: string) => {
    const newShifts = [...shifts];
    newShifts[index] = { ...newShifts[index], [field]: value };
    onChange(newShifts);
  };

  const removeShift = (index: number) => {
    const newShifts = shifts.filter((_, i) => i !== index);
    onChange(newShifts);
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
          className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="font-bold text-slate-700">{weekLabel}</div>
        <button
          type="button"
          onClick={goToNextWeek}
          className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {days.map((date) => {
        const dateStr = format(date, "yyyy-MM-dd");
        const isPast = isBefore(date, today);
        const dayShifts = shifts
          .map((s, i) => ({ ...s, originalIndex: i }))
          .filter((s) => s.date === dateStr);
        const dayLabel = format(date, "M/d (E)", { locale: ja });
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        return (
          <div
            key={dateStr}
            className={`rounded-xl border p-4 transition-all ${
              isPast
                ? "border-slate-100 bg-slate-50 opacity-60"
                : dayShifts.length > 0
                  ? "border-pink-200 bg-pink-50/30"
                  : "border-slate-100 bg-white"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`text-sm font-bold ${
                  isPast
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
                  onClick={() => addShift(dateStr)}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 transition-colors hover:bg-pink-100 hover:text-pink-600"
                >
                  <Plus size={14} />
                  <span>Add Shift</span>
                </button>
              )}
            </div>

            {dayShifts.length === 0 ? (
              <div className="text-xs text-slate-400 text-center py-2">
                {isPast ? "受付終了" : "No shift (お休み)"}
              </div>
            ) : (
              <div className="space-y-2">
                {dayShifts.map((shift, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 rounded-lg bg-white border border-slate-200 p-2 shadow-sm"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex flex-1 items-center gap-2">
                        <Clock size={14} className="text-slate-400" />
                        <select
                          value={shift.start}
                          disabled={isPast}
                          onChange={(e) =>
                            updateShift(
                              shift.originalIndex,
                              "start",
                              e.target.value,
                            )
                          }
                          className="bg-transparent font-bold text-slate-700 focus:outline-none disabled:text-slate-400 text-sm"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={`start-${t}`} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400">-</span>
                        <select
                          value={shift.end}
                          disabled={isPast}
                          onChange={(e) =>
                            updateShift(
                              shift.originalIndex,
                              "end",
                              e.target.value,
                            )
                          }
                          className="bg-transparent font-bold text-slate-700 focus:outline-none disabled:text-slate-400 text-sm"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={`end-${t}`} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>
                      {!isPast && (
                        <button
                          type="button"
                          onClick={() => removeShift(shift.originalIndex)}
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
                          <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Plan
                          </span>
                          <select
                            value={shift.planId || ""}
                            onChange={(e) =>
                              updateShift(
                                shift.originalIndex,
                                "planId",
                                e.target.value,
                              )
                            }
                            className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:border-pink-300 focus:outline-none"
                          >
                            <option value="">All Plans (Default)</option>
                            {plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        {(() => {
                          const selectedPlan = plans.find(
                            (p) => p.id === shift.planId,
                          );
                          if (!selectedPlan) return null;
                          const shiftMins = getDuration(shift.start, shift.end);
                          if (shiftMins <= 0) return null;
                          const maxCount = Math.floor(
                            shiftMins / selectedPlan.duration,
                          );

                          return (
                            <div className="text-[10px] text-right text-slate-400">
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
