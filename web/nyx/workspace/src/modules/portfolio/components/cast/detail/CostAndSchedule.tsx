"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

interface PriceSystemProps {
  plans?: ServicePlan[];
}

export const PriceSystem = ({ plans }: PriceSystemProps) => {
  // If no plans provided, show placeholder
  if (!plans || plans.length === 0) {
    return (
      <div className="bg-slate-50 px-6 py-8 space-y-6">
        <h3 className="font-serif font-bold text-lg text-slate-800">
          System & Plan
        </h3>
        <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-400 text-center">
            No plans available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 px-6 py-8 space-y-6">
      <h3 className="font-serif font-bold text-lg text-slate-800">
        System & Plan
      </h3>

      {plans.map((plan, idx) => (
        <div
          key={plan.id || idx}
          className="rounded-xl bg-white p-5 border border-slate-200 shadow-sm relative overflow-hidden"
        >
          {idx === 0 && (
            <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
              POPULAR
            </div>
          )}
          <div className="text-sm font-bold text-slate-500 uppercase mb-2">
            {plan.name}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900">
              ¥{plan.price.toLocaleString()}
            </span>
            <span className="text-sm text-slate-400">/ {plan.duration}min</span>
          </div>
        </div>
      ))}
    </div>
  );
};

interface ScheduleCalendarProps {
  schedules?: WeeklySchedule[];
  plans?: ServicePlan[];
}

interface DayData {
  day: string;
  date: string;
  fullDate: string;
  month: number;
  schedules: WeeklySchedule[];
  isWeekend: boolean;
  isToday: boolean;
  timeRange: string | null;
}

export const ScheduleCalendar = ({ schedules, plans }: ScheduleCalendarProps) => {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  // Generate next 28 days (4 weeks)
  const today = new Date();
  const days: DayData[] = Array.from({ length: 28 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    // Find all schedules for this date
    const daySchedules = schedules?.filter((s) => s.date === dateStr) || [];

    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    // Calculate time range (earliest start - latest end)
    let timeRange: string | null = null;
    if (daySchedules.length > 0) {
      const starts = daySchedules.map((s) => s.start).sort();
      const ends = daySchedules.map((s) => s.end).sort();
      const earliest = starts[0];
      const latest = ends[ends.length - 1];
      timeRange = `${earliest}-${latest}`;
    }

    return {
      day: date.toLocaleDateString("ja-JP", { weekday: "short" }),
      date: date.getDate().toString(),
      fullDate: dateStr,
      month: date.getMonth() + 1,
      schedules: daySchedules,
      isWeekend,
      isToday: i === 0,
      timeRange,
    };
  });

  // Helper to get plan by ID
  const getPlanById = (planId?: string) => {
    if (!planId || !plans) return null;
    return plans.find((p) => p.id === planId) || null;
  };

  return (
    <div className="py-8 bg-white">
      <h3 className="font-serif font-bold text-lg text-slate-800 mb-4 px-6">
        Availability
      </h3>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 px-6" style={{ width: "max-content" }}>
          {days.map((item, idx) => {
            const hasSchedule = item.schedules.length > 0;
            return (
              <button
                key={idx}
                onClick={() => hasSchedule && setSelectedDay(item)}
                disabled={!hasSchedule}
                className={`
                  flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-colors
                  ${item.isToday ? "bg-pink-50 border border-pink-200" : ""}
                  ${hasSchedule ? "hover:bg-slate-50 cursor-pointer" : "opacity-50 cursor-default"}
                `}
              >
                <div
                  className={`text-[10px] font-bold ${
                    item.isWeekend ? "text-pink-400" : "text-slate-400"
                  }`}
                >
                  {item.day}
                </div>
                <div
                  className={`
                    flex items-center justify-center h-9 w-9 rounded-full text-sm font-bold
                    ${hasSchedule
                      ? "bg-green-100 text-green-700"
                      : "bg-slate-100 text-slate-300"
                    }
                  `}
                >
                  {item.date}
                </div>
                {item.timeRange ? (
                  <div className="text-[10px] font-medium text-slate-600 whitespace-nowrap">
                    {item.timeRange}
                  </div>
                ) : (
                  <div className="text-[10px] font-medium text-slate-300">
                    -
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400 mt-3 px-6">
        タップで詳細を表示 / スクロールで4週間分
      </p>

      {/* Schedule Detail Modal */}
      {selectedDay && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setSelectedDay(null)}
        >
          <div
            className="w-full max-w-md bg-white rounded-t-2xl p-6 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-bold text-slate-800">
                {selectedDay.month}/{selectedDay.date} ({selectedDay.day})
              </h4>
              <button
                onClick={() => setSelectedDay(null)}
                className="p-2 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              {selectedDay.schedules.map((schedule, idx) => {
                const plan = getPlanById(schedule.planId);
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-xl"
                  >
                    <div>
                      <div className="text-lg font-bold text-slate-800">
                        {schedule.start} - {schedule.end}
                      </div>
                      {plan && (
                        <div className="text-sm text-slate-500 mt-1">
                          {plan.name}
                        </div>
                      )}
                    </div>
                    {plan && (
                      <div className="text-right">
                        <div className="text-lg font-bold text-pink-500">
                          ¥{plan.price.toLocaleString()}
                        </div>
                        <div className="text-xs text-slate-400">
                          {plan.duration}min
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedDay.schedules.length > 1 && (
              <p className="text-xs text-slate-400 text-center mt-4">
                {selectedDay.schedules.length}件の予約枠
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
