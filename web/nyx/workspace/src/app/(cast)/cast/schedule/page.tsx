"use client";

import { useState } from "react";
import { WeeklyScheduleInput, ScheduleItem } from "@/modules/ritual/components/cast/WeeklyScheduleInput";
import { ActionButton } from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/Toast";

export default function SchedulePage() {
  // Mock initial data
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    { date: "2026-01-20", start: "19:00", end: "23:00" },
    { date: "2026-01-22", start: "20:00", end: "24:00" },
  ]);
  const { toast } = useToast();

  const handleSave = async () => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Saving schedules:", schedules);
    toast({ title: "Success", description: "スケジュールを保存しました", variant: "success" });
  };

  return (
    <div className="flex flex-col p-4 lg:p-6 pb-24 max-w-lg mx-auto w-full min-h-screen">

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <p className="text-sm text-slate-500 mb-4">
          設定したスケジュールは「即レス（Online）」または「要相談（Asking）」の目安としてゲストに表示されます。
        </p>

        <WeeklyScheduleInput schedules={schedules} onChange={setSchedules} />
      </div>

      <div className="flex flex-col gap-4 px-4 pb-12 items-center">
        <ActionButton
          mode="save"
          label="Save Schedule"
          onClick={handleSave}
          className="max-w-md"
        />
      </div>
    </div>
  );
}
