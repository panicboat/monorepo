"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { ScheduleEditor } from "@/modules/portfolio/components/cast/ScheduleEditor";
import { ActionButton } from "@/components/ui/ActionButton";
import { useToast } from "@/components/ui/Toast";
import { useCastSchedules } from "@/modules/portfolio/hooks";
import { useCastProfile } from "@/modules/portfolio/hooks/useCastProfile";

export default function ManageSchedulesPage() {
  const { toast } = useToast();
  const { rawData } = useCastProfile();
  const { schedules, loading, fetchSchedules, updateSchedules, saveSchedules } =
    useCastSchedules();

  const defaultScheduleStart = rawData?.profile?.defaultScheduleStart || "18:00";
  const defaultScheduleEnd = rawData?.profile?.defaultScheduleEnd || "23:00";

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const handleSave = async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const futureSchedules = schedules.filter((s) => s.date >= today);
      await saveSchedules(futureSchedules);
      toast({
        title: "Saved",
        description: "Your schedules have been updated successfully.",
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save schedules:", error);
      toast({
        title: "Error",
        description: "Failed to save schedules. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container max-w-lg mx-auto pb-24 px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Manage Schedules</h1>
          <p className="text-text-secondary text-sm">
            Set your availability. Guests will see when you're available.
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-border rounded"></div>
          <div className="h-24 bg-border rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-lg mx-auto pb-24 px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Manage Schedules</h1>
        <p className="text-text-secondary text-sm">
          Set your availability. Guests will see when you're available.
        </p>
      </div>

      <ScheduleEditor
        schedules={schedules}
        onChange={updateSchedules}
        defaultStart={defaultScheduleStart}
        defaultEnd={defaultScheduleEnd}
      />

      <div className="flex flex-col gap-4 px-4 pb-12 items-center mt-8">
        <ActionButton
          mode="save"
          label="Save Changes"
          onClick={handleSave}
          className="max-w-md"
          role="cast"
        />
      </div>
    </div>
  );
}
