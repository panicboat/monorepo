"use client";

import { useState, useMemo } from "react";
import { PhotoGallery } from "./cast/detail/PhotoGallery";
import { ProfileSpecs } from "./cast/detail/ProfileSpecs";
import { ScheduleCalendar, PriceSystem } from "./cast/detail/CostAndSchedule";
import { CastProfile, ProfileFormData, MediaItem, ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

// Get today's date in YYYY-MM-DD format
const getTodayDateStr = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

interface CastDetailViewProps {
  castId: string;
  profileData?: CastProfile | ProfileFormData;
  images?: MediaItem[];
  plans?: ServicePlan[];
  schedules?: WeeklySchedule[];
}

export const CastDetailView = ({
  castId,
  profileData,
  images,
  plans = [],
  schedules = [],
}: CastDetailViewProps) => {
  // Initialize with today's date selected
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr);

  // Get schedules for the selected date
  const selectedSchedules = useMemo(() => {
    return schedules.filter((s) => s.date === selectedDate);
  }, [schedules, selectedDate]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  return (
    <div className="bg-surface">
      <PhotoGallery castId={castId} images={images} />
      <ProfileSpecs castId={castId} profileData={profileData} />
      <ScheduleCalendar
        schedules={schedules}
        onDateSelect={handleDateSelect}
        selectedDate={selectedDate}
      />
      <PriceSystem
        plans={plans}
        selectedSchedules={selectedSchedules}
        hasDateSelected={true}
      />
    </div>
  );
};
