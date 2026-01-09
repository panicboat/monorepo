"use client";

import { useState } from "react";
import { WeeklyShiftInput, ScheduleItem } from "@/modules/ritual/components/cast/WeeklyShiftInput";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/modules/shell/components/ui/use-toast";

export default function SchedulePage() {
  // Mock initial data
  const [schedules, setSchedules] = useState<ScheduleItem[]>([
    { date: "2026-01-20", start: "19:00", end: "23:00" },
    { date: "2026-01-22", start: "20:00", end: "24:00" },
  ]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("Saving schedules:", schedules);
    toast({ title: "Success", description: "スケジュールを保存しました" });
    setSaving(false);
  };

  return (
    <div className="flex flex-col p-4 lg:p-6 pb-24 max-w-lg mx-auto w-full min-h-screen">

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-6">
        <p className="text-sm text-slate-500 mb-4">
          設定したスケジュールは「即レス（Online）」または「要相談（Asking）」の目安としてゲストに表示されます。
        </p>

        <WeeklyShiftInput schedules={schedules} onChange={setSchedules} />
      </div>

      <div className="flex flex-col gap-4 px-4 pb-12 items-center">
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex w-full max-w-md items-center justify-center gap-2 rounded-xl py-3 font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50 ${saving
            ? "bg-pink-400 cursor-not-allowed"
            : "bg-pink-500 hover:bg-pink-600 shadow-pink-200 hover:shadow-pink-300"
            }`}
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          <span>{saving ? "Saving..." : "Save Schedule"}</span>
        </button>
      </div>
    </div>
  );
}
