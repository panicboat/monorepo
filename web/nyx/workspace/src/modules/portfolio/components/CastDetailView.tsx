"use client";

import { PhotoGallery } from "./cast/detail/PhotoGallery";
import { ProfileSpecs } from "./cast/detail/ProfileSpecs";
import { ScheduleCalendar, PriceSystem } from "./cast/detail/CostAndSchedule";
import { CastProfile, ProfileFormData, MediaItem, ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

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
  return (
    <div className="bg-white">
      <PhotoGallery castId={castId} images={images} />
      <ProfileSpecs castId={castId} profileData={profileData} />
      <ScheduleCalendar schedules={schedules} plans={plans} />
      <PriceSystem plans={plans} />
    </div>
  );
};
