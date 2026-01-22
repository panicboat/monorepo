"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import {
  WeeklyScheduleInput,
  ScheduleItem,
} from "@/modules/ritual/components/cast/WeeklyScheduleInput";
import { useOnboardingStore } from "@/stores/onboarding";

export default function OnboardingStep4() {
  const router = useRouter();

  // Zustand store
  const profile = useOnboardingStore((s) => s.profile);
  const plans = useOnboardingStore((s) => s.plans);
  const schedules = useOnboardingStore((s) => s.schedules);
  const setSchedules = useOnboardingStore((s) => s.setSchedules);
  const saveSchedules = useOnboardingStore((s) => s.saveSchedules);
  const loading = useOnboardingStore((s) => s.loading);
  const initialized = useOnboardingStore((s) => s.initialized);
  const fetchProfile = useOnboardingStore((s) => s.fetchProfile);

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchProfile();
    }
  }, [initialized, fetchProfile]);

  // Convert plans to SchedulePlan format
  const availablePlans = plans.map((p) => ({
    id: p.id,
    name: p.name,
    duration: p.duration,
    price: p.price,
  }));

  const defaultScheduleStart = profile.defaultScheduleStart || "18:00";
  const defaultScheduleEnd = profile.defaultScheduleEnd || "23:00";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (schedules.length < 1) return;
    await saveSchedules(schedules);
    router.push("/cast/onboarding/step-5");
  };

  const isNextEnabled = schedules.length >= 1;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

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
        <WeeklyScheduleInput
          schedules={schedules}
          plans={availablePlans}
          onChange={setSchedules}
          defaultStart={defaultScheduleStart}
          defaultEnd={defaultScheduleEnd}
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
