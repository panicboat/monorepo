"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

interface PriceSystemProps {
  plans?: ServicePlan[];
}

export const PriceSystem = ({ plans }: PriceSystemProps) => {
  // If no plans provided, show placeholder
  if (!plans || plans.length === 0) {
    return (
      <div className="bg-surface-secondary px-6 py-8 space-y-6">
        <h3 className="font-serif font-bold text-lg text-text-primary">
          System & Plan
        </h3>
        <div className="rounded-xl bg-surface p-5 border border-border shadow-sm">
          <p className="text-sm text-text-muted text-center">
            No plans available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary px-6 py-8 space-y-6">
      <h3 className="font-serif font-bold text-lg text-text-primary">
        System & Plan
      </h3>

      {plans.map((plan, idx) => (
        <div
          key={plan.id || idx}
          className="rounded-xl bg-surface p-5 border border-border shadow-sm relative overflow-hidden"
        >
          {idx === 0 && (
            <div className="absolute top-0 right-0 bg-role-cast text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl">
              POPULAR
            </div>
          )}
          <div className="text-sm font-bold text-text-secondary uppercase mb-2">
            {plan.name}
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-text-primary">
              ¥{plan.price.toLocaleString()}
            </span>
            <span className="text-sm text-text-muted">/ {plan.duration}min</span>
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
    // Use local timezone instead of UTC to match backend date format
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

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
    <div className="py-8 bg-surface">
      <h3 className="font-serif font-bold text-lg text-text-primary mb-4 px-6">
        Availability
      </h3>
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-2 px-6" style={{ width: "max-content" }}>
          {days.map((item, idx) => {
            const hasSchedule = item.schedules.length > 0;
            return (
              <button
                key={idx}
                onClick={() => {
                  if (!hasSchedule) return;
                  // Toggle: close if same day selected, otherwise open new day
                  setSelectedDay(selectedDay?.fullDate === item.fullDate ? null : item);
                }}
                disabled={!hasSchedule}
                className={`
                  flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-colors
                  ${item.isToday ? "bg-role-cast-light/30 border border-role-cast-light" : ""}
                  ${selectedDay?.fullDate === item.fullDate ? "bg-success-light/30 border border-success" : ""}
                  ${hasSchedule ? "hover:bg-surface-secondary cursor-pointer" : "opacity-50 cursor-default"}
                `}
              >
                <div
                  className={`text-[10px] font-bold ${
                    item.isWeekend ? "text-role-cast" : "text-text-muted"
                  }`}
                >
                  {item.day}
                </div>
                <div
                  className={`
                    flex items-center justify-center h-9 w-9 rounded-full text-sm font-bold
                    ${hasSchedule
                      ? "bg-success-light text-success"
                      : "bg-surface-secondary text-text-muted"
                    }
                  `}
                >
                  {item.date}
                </div>
                {item.timeRange ? (
                  <div className="text-[10px] font-medium text-text-secondary whitespace-nowrap">
                    {item.timeRange}
                  </div>
                ) : (
                  <div className="text-[10px] font-medium text-text-muted">
                    -
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <p className="text-center text-xs text-text-muted mt-3 px-6">
        タップで詳細を表示 / スクロールで4週間分
      </p>

      {/* Inline Schedule Detail */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            className="mx-6 mt-4 overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="bg-surface-secondary rounded-xl p-4">
              <button
                onClick={() => setSelectedDay(null)}
                className="flex items-center justify-between w-full mb-3"
              >
                <h4 className="text-base font-bold text-text-primary">
                  {selectedDay.month}/{selectedDay.date} ({selectedDay.day})
                </h4>
                <ChevronDown size={18} className="text-text-muted" />
              </button>

              <div className="space-y-2">
                {selectedDay.schedules.map((schedule, idx) => {
                  const plan = getPlanById(schedule.planId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-surface rounded-lg"
                    >
                      <div>
                        <div className="text-sm font-bold text-text-primary">
                          {schedule.start} - {schedule.end}
                        </div>
                        {plan && (
                          <div className="text-xs text-text-secondary mt-0.5">
                            {plan.name}
                          </div>
                        )}
                      </div>
                      {plan && (
                        <div className="text-right">
                          <div className="text-sm font-bold text-role-cast">
                            ¥{plan.price.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-text-muted">
                            {plan.duration}min
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedDay.schedules.length > 1 && (
                <p className="text-[10px] text-text-muted text-center mt-3">
                  {selectedDay.schedules.length}件の予約枠
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
