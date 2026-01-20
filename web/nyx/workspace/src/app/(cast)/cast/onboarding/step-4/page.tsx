"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  WeeklyShiftInput,
  ScheduleItem,
} from "@/modules/ritual/components/cast/WeeklyShiftInput";

import { useOnboarding } from "../context";

export default function OnboardingStep4() {
  const router = useRouter();
  const { data, setShifts, saveSchedules } = useOnboarding();
  const [schedules, setSchedulesState] = useState<ScheduleItem[]>(data.shifts || []);

  // Use real plans from context
  const availablePlans = data.plans;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (schedules.length < 1) return;
    setShifts(schedules);
    await saveSchedules();
    router.push("/cast/onboarding/step-5");
  };

  const isNextEnabled = schedules.length >= 1;

  return (
    <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-slate-900 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm text-white">
            4
          </span>
          Initial Schedule
        </h2>
        <p className="text-sm text-slate-500">
          まずは直近の出勤可能日を登録しましょう。
          <br />
          あとからカレンダーで自由に調整できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <WeeklyShiftInput
          schedules={schedules}
          plans={availablePlans}
          onChange={setSchedulesState}
        />

        <button
          type="submit"
          disabled={!isNextEnabled}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-pink-500 py-4 font-bold text-white shadow-lg shadow-pink-200 transition-all hover:bg-pink-600 hover:shadow-pink-300 disabled:bg-slate-300 disabled:shadow-none"
        >
          <span>Next Step: Review</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
