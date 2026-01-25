"use client";

import { X } from "lucide-react";
import { ProfileFormData, MediaItem, ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";
import { CastDetailView } from "@/modules/portfolio/components/CastDetailView";

interface ProfilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: ProfileFormData;
  images: MediaItem[];
  plans?: ServicePlan[];
  schedules?: WeeklySchedule[];
}

export const ProfilePreviewModal = ({
  isOpen,
  onClose,
  formData,
  images,
  plans = [],
  schedules = [],
}: ProfilePreviewModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      {/* transform creates new containing block to constrain inner fixed modals */}
      <div className="relative w-full max-w-md h-[90vh] bg-slate-50 rounded-2xl overflow-hidden shadow-2xl flex flex-col transform-gpu">
        {/* Fixed Header Bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 via-black/30 to-transparent">
          <span className="text-white/80 text-sm font-medium">Preview</span>
          <button
            onClick={onClose}
            className="p-2 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 w-full overflow-y-auto -mt-14">
          <div className="pb-20 bg-slate-50 min-h-full">
            <CastDetailView
              castId="preview"
              profileData={formData}
              images={images.length > 0 ? images : undefined}
              plans={plans}
              schedules={schedules}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
