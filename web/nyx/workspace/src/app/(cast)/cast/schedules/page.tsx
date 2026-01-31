"use client";

import { useEffect } from "react";
import { WeeklyScheduleInput } from "@/modules/ritual/components/cast/WeeklyScheduleInput";
import { ActionButton } from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/Toast";
import { useCastData } from "@/modules/portfolio/hooks";
import { WeeklySchedule } from "@/modules/portfolio/types";

export default function SchedulePage() {
  const { toast } = useToast();
  const {
    profile,
    plans,
    schedules,
    loading,
    initialized,
    fetchData,
    updateSchedules,
    saveSchedules,
  } = useCastData({ apiPath: "/api/cast/profile" });

  useEffect(() => {
    if (!initialized) {
      fetchData();
    }
  }, [initialized, fetchData]);

  // Convert plans to SchedulePlan format
  const availablePlans = plans.map((p) => ({
    id: p.id,
    name: p.name,
    duration: p.duration,
    price: p.price,
  }));

  const defaultScheduleStart = profile.defaultScheduleStart || "10:00";
  const defaultScheduleEnd = profile.defaultScheduleEnd || "22:00";

  const handleSchedulesChange = (newSchedules: WeeklySchedule[]) => {
    updateSchedules(newSchedules);
  };

  const handleSave = async () => {
    try {
      await saveSchedules(schedules);
      toast({ title: "Success", description: "スケジュールを保存しました", variant: "success" });
    } catch (error) {
      console.error("Failed to save schedules:", error);
      toast({ title: "Error", description: "スケジュールの保存に失敗しました", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col p-4 lg:p-6 pb-24 max-w-lg mx-auto w-full min-h-screen">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-32 bg-slate-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 lg:p-6 pb-24 max-w-lg mx-auto w-full min-h-screen">

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <p className="text-sm text-slate-500 mb-4">
          設定したスケジュールは「即レス（Online）」または「要相談（Asking）」の目安としてゲストに表示されます。
        </p>

        <WeeklyScheduleInput
          schedules={schedules}
          plans={availablePlans}
          onChange={handleSchedulesChange}
          defaultStart={defaultScheduleStart}
          defaultEnd={defaultScheduleEnd}
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pb-12 items-center">
        <ActionButton
          mode="save"
          label="Save Schedule"
          onClick={handleSave}
          className="max-w-md"
          role="cast"
        />
      </div>
    </div>
  );
}
