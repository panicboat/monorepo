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
  // Generate next 7 days
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD

    // Find schedule for this date
    const schedule = schedules?.find((s) => s.date === dateStr);

    // Determine status based on schedule presence
    // "◎" Wide Open, "○" Open, "△" Few Left, "×" Full/Unavailable
    const status = schedule ? "○" : "×";

    return {
      day: date.toLocaleDateString("en-US", { weekday: "short" }),
      date: date.getDate().toString(),
      status,
      schedule,
    };
  });

  return (
    <div className="px-6 py-8 bg-white">
      <h3 className="font-serif font-bold text-lg text-slate-800 mb-4">
        Availability
      </h3>
      <div className="flex justify-between gap-2 text-center">
        {week.map((item, idx) => (
          <div key={idx} className="flex flex-col items-center gap-2 flex-1">
            <div className="text-xs text-slate-400 font-bold">{item.day}</div>
            <div
              className={`
                flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold
                ${item.status === "○" ? "bg-green-100 text-green-600" : "bg-slate-100 text-slate-300"}
              `}
            >
              {item.status === "○" ? item.date : "-"}
            </div>
            <div className="text-xs font-bold text-slate-500">
              {item.status}
            </div>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400 mt-4">
        ◎ Wide Open ○ Open △ Few Left × Full
      </p>
    </div>
  );
};
