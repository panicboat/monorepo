"use client";

import { Star } from "lucide-react";
import { ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

interface PriceSystemProps {
  plans?: ServicePlan[];
  selectedSchedules?: WeeklySchedule[];
  hasDateSelected?: boolean;
}

export const PriceSystem = ({
  plans,
  selectedSchedules = [],
  hasDateSelected = false,
}: PriceSystemProps) => {
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

  const hasSchedules = selectedSchedules.length > 0;

  // Sort plans: recommended first, then by price descending
  const sortedPlans = [...plans].sort((a, b) => {
    if (a.isRecommended && !b.isRecommended) return -1;
    if (!a.isRecommended && b.isRecommended) return 1;
    return b.price - a.price;
  });

  // Get time ranges from selected schedules (all schedules apply to all plans)
  const getTimeRanges = (): string[] => {
    return selectedSchedules.map((s) => `${s.start} - ${s.end}`);
  };

  // Plan is active if:
  // - No date selected: all plans active
  // - Date selected with schedules: all plans active
  // - Date selected without schedules: all plans inactive
  const isPlanActive = (): boolean => {
    if (!hasDateSelected) return true;
    return hasSchedules;
  };

  return (
    <div className="bg-surface-secondary px-6 py-8 space-y-4">
      <h3 className="font-serif font-bold text-lg text-text-primary">
        System & Plan
      </h3>

      {sortedPlans.map((plan, idx) => {
        const isActive = isPlanActive();
        const timeRanges = hasDateSelected ? getTimeRanges() : [];

        return (
          <div
            key={plan.id || idx}
            className={`
              rounded-xl bg-surface p-5 border shadow-sm transition-all duration-200
              ${isActive
                ? "border-border opacity-100"
                : "border-border/50 opacity-40"
              }
              ${timeRanges.length > 0 ? "border-success" : ""}
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-text-secondary uppercase">
                {plan.name}
              </span>
              {plan.isRecommended && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-warning-lighter text-warning text-xs font-bold">
                  <Star size={10} className="fill-current" />
                  おすすめ
                </span>
              )}
            </div>
            {timeRanges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {timeRanges.map((time, i) => (
                  <span
                    key={i}
                    className="text-xs font-medium text-success bg-success-light/30 px-2 py-1 rounded"
                  >
                    {time}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold text-text-primary">
                ¥{plan.price.toLocaleString()}
              </span>
              <span className="text-sm text-text-muted">/ {plan.duration}min</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface ScheduleCalendarProps {
  schedules?: WeeklySchedule[];
  selectedDate?: string;
  onDateSelect?: (date: string) => void;
}

interface DayData {
  day: string;
  date: string;
  fullDate: string;
  schedules: WeeklySchedule[];
  isWeekend: boolean;
  isToday: boolean;
  timeRange: string | null;
}

export const ScheduleCalendar = ({
  schedules,
  selectedDate,
  onDateSelect,
}: ScheduleCalendarProps) => {

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
      schedules: daySchedules,
      isWeekend,
      isToday: i === 0,
      timeRange,
    };
  });

  const handleDateClick = (item: DayData) => {
    // Select the clicked date (no toggle - always select)
    onDateSelect?.(item.fullDate);
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
            const isSelected = selectedDate === item.fullDate;

            return (
              <button
                key={idx}
                onClick={() => handleDateClick(item)}
                className={`
                  flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl transition-colors cursor-pointer
                  ${item.isToday && !isSelected ? "bg-role-cast-light/30 border border-role-cast-light" : ""}
                  ${isSelected ? "bg-success-light/30 border border-success" : ""}
                  ${!isSelected && !item.isToday ? "hover:bg-surface-secondary" : ""}
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
        タップでプランを表示 / スクロールで4週間分
      </p>
    </div>
  );
};
