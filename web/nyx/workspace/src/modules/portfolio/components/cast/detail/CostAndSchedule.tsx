"use client";

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
}

export const ScheduleCalendar = ({ schedules }: ScheduleCalendarProps) => {
  // Generate next 28 days (4 weeks)
  const today = new Date();
  const days = Array.from({ length: 28 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    // Find all schedules for this date
    const daySchedules = schedules?.filter((s) => s.date === dateStr) || [];

    const isWeekend = date.getDay() === 0 || date.getDay() === 6;

    return {
      day: date.toLocaleDateString("ja-JP", { weekday: "short" }),
      date: date.getDate().toString(),
      month: date.getMonth() + 1,
      schedules: daySchedules,
      isWeekend,
      isToday: i === 0,
    };
  });

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
              <div
                key={idx}
                className={`
                  flex flex-col items-center gap-1 min-w-[60px] p-2 rounded-xl
                  ${item.isToday ? "bg-pink-50 border border-pink-200" : ""}
                  ${hasSchedule ? "" : "opacity-50"}
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
                {hasSchedule ? (
                  <div className="flex flex-col items-center gap-0.5">
                    {item.schedules.map((schedule, sIdx) => (
                      <div
                        key={sIdx}
                        className="text-[10px] font-medium text-slate-600 whitespace-nowrap"
                      >
                        {schedule.start}-{schedule.end}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[10px] font-medium text-slate-300">
                    -
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-center text-xs text-slate-400 mt-3 px-6">
        ← スクロールで4週間分を確認できます
      </p>
    </div>
  );
};
