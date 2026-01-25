"use client";

import { useState, useEffect } from "react";
import { WeeklyScheduleInput, ScheduleItem } from "@/modules/ritual/components/cast/WeeklyScheduleInput";
import { ActionButton } from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/Toast";

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const response = await fetch("/api/cast/schedules");
        if (!response.ok) {
          throw new Error("Failed to fetch schedules");
        }
        const data = await response.json();
        setSchedules(data.schedules || []);
      } catch (error) {
        console.error("Failed to fetch schedules:", error);
        toast({ title: "Error", description: "スケジュールの取得に失敗しました", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSchedules();
  }, [toast]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/cast/schedules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schedules: schedules.map((s) => ({
            date: s.date,
            startTime: s.start,
            endTime: s.end,
            planId: s.planId || "",
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save schedules");
      }

      toast({ title: "Success", description: "スケジュールを保存しました", variant: "success" });
    } catch (error) {
      console.error("Failed to save schedules:", error);
      toast({ title: "Error", description: "スケジュールの保存に失敗しました", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
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

        <WeeklyScheduleInput schedules={schedules} onChange={setSchedules} />
      </div>

      <div className="flex flex-col gap-4 px-4 pb-12 items-center">
        <ActionButton
          mode="save"
          label={isSaving ? "Saving..." : "Save Schedule"}
          onClick={handleSave}
          disabled={isSaving}
          className="max-w-md"
        />
      </div>
    </div>
  );
}
