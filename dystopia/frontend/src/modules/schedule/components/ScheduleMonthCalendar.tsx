"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { WEEKDAYS, formatDayLabel, toDateKey } from "@/modules/schedule/lib/dates";

interface ScheduleMonthCalendarProps {
  days: string[];
  selected: ReadonlySet<string>;
  plans?: ReadonlyMap<string, { startTime: string; endTime: string }>;
  onToggle: (dateKey: string) => void;
}

const monthArrowClass = "flex size-10 items-center justify-center rounded-full text-text-secondary hover:text-text-primary disabled:opacity-30";

export function ScheduleMonthCalendar({ days, selected, plans, onToggle }: ScheduleMonthCalendarProps) {
  const months = [...new Set(days.map((dateKey) => dateKey.slice(0, 7)))];
  const [monthIndex, setMonthIndex] = useState(() => Math.max(0, months.findIndex((month) => [...selected].some((dateKey) => dateKey.startsWith(month)))));
  const [year, month] = months[monthIndex].split("-").map(Number);
  const selectable = new Set(days);
  const leadingBlanks = new Date(year, month - 1, 1).getDay();
  const monthDays = Array.from({ length: new Date(year, month, 0).getDate() }, (_, i) => toDateKey(new Date(year, month - 1, i + 1)));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="前の月" disabled={monthIndex === 0} onClick={() => setMonthIndex(monthIndex - 1)} className={monthArrowClass}>
          <ChevronLeft size={20} />
        </button>
        <p className="text-sm font-bold text-text-primary">{`${year}年 ${month}月`}</p>
        <button
          type="button"
          aria-label="次の月"
          disabled={monthIndex === months.length - 1}
          onClick={() => setMonthIndex(monthIndex + 1)}
          className={monthArrowClass}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="text-center text-xs text-text-secondary">
            {weekday}
          </span>
        ))}
        {Array.from({ length: leadingBlanks }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {monthDays.map((dateKey) => {
          const dayNumber = Number(dateKey.slice(-2));
          if (!selectable.has(dateKey)) {
            return (
              <span key={dateKey} className="flex h-10 items-center justify-center text-sm text-text-secondary opacity-40">
                {dayNumber}
              </span>
            );
          }
          const plan = plans?.get(dateKey);
          const isSelected = selected.has(dateKey);
          return (
            <button
              key={dateKey}
              type="button"
              data-day={dateKey}
              aria-pressed={isSelected}
              aria-label={plans ? `${formatDayLabel(dateKey)} ${plan ? `${plan.startTime} 〜 ${plan.endTime}` : "未設定"}` : formatDayLabel(dateKey)}
              onClick={() => onToggle(dateKey)}
              className={cn(
                "flex h-10 min-w-0 flex-col items-center justify-center rounded-lg border text-sm leading-none",
                isSelected ? "border-accent bg-accent/15 font-bold text-text-primary" : "border-border text-text-secondary"
              )}
            >
              <span>{dayNumber}</span>
              {plan && <span className="mt-0.5 text-[10px] font-normal tabular-nums text-accent">{plan.startTime}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
