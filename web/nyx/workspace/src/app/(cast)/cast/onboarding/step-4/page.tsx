"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ScheduleEditor } from "@/modules/portfolio/components/cast/ScheduleEditor";
import { useCastData } from "@/modules/portfolio/hooks";
import { WeeklySchedule } from "@/modules/portfolio/types";

export default function OnboardingStep4() {
  const router = useRouter();

  const {
    profile,
    schedules,
    loading,
    initialized,
    fetchData,
    updateSchedules,
    saveSchedules,
  } = useCastData();

  // Initialize data on mount
  useEffect(() => {
    if (!initialized) {
      fetchData();
    }
  }, [initialized, fetchData]);

  const defaultScheduleStart = profile.defaultScheduleStart || "18:00";
  const defaultScheduleEnd = profile.defaultScheduleEnd || "23:00";

  const handleSchedulesChange = (newSchedules: WeeklySchedule[]) => {
    updateSchedules(newSchedules);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const today = format(new Date(), "yyyy-MM-dd");
    const futureSchedules = schedules.filter((s) => s.date >= today);
    await saveSchedules(futureSchedules);
    router.push("/cast/onboarding/step-5");
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-role-cast border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 animate-in slide-in-from-right-8 fade-in duration-500">
      <div className="space-y-2">
        <h2 className="text-xl font-serif font-bold text-text-primary flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm text-white">
            4
          </span>
          Initial Schedule
        </h2>
        <p className="text-sm text-text-secondary">
          まずは直近の出勤可能日を登録しましょう。
          <br />
          あとからカレンダーで自由に調整できます。
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl bg-info-lighter p-4 text-xs font-bold text-info">
            <Calendar size={16} />
            <span>スケジュールの登録は任意です</span>
          </div>

          <ScheduleEditor
            schedules={schedules}
            onChange={handleSchedulesChange}
            defaultStart={defaultScheduleStart}
            defaultEnd={defaultScheduleEnd}
          />
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-role-cast py-4 font-bold text-white shadow-lg shadow-role-cast-shadow transition-all hover:bg-role-cast-hover hover:shadow-role-cast-shadow"
        >
          <span>Next Step: Review</span>
          <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}
