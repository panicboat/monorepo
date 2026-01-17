"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ProfileFormData, MediaItem } from "@/modules/portfolio/types";
import { PhotoGallery } from "@/modules/portfolio/components/guest/detail/PhotoGallery";
import { ProfileSpecs } from "@/modules/portfolio/components/guest/detail/ProfileSpecs";

interface ProfilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  formData: ProfileFormData;
  images: MediaItem[];
}

export const ProfilePreviewModal = ({
  isOpen,
  onClose,
  formData,
  images,
}: ProfilePreviewModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md h-[90vh] bg-slate-50 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Close Button Overlay */}
        <Button
          onClick={onClose}
          size="icon"
          variant="ghost"
          className="absolute top-4 right-4 z-50 bg-black/50 text-white rounded-full backdrop-blur-md hover:bg-black/70 hover:text-white transition-colors"
        >
          <X size={20} />
        </Button>

        <div className="flex-1 w-full overflow-y-auto">
          {/*
              Reusing Guest Detail Components.
              We pass the form data and images directly.
            */}
          <div className="pb-20 bg-slate-50 min-h-full">
            <PhotoGallery
              castId="preview"
              images={images.length > 0 ? images : undefined}
            />
            <ProfileSpecs castId="preview" profileData={formData} />
          </div>
        </div>
      </div>
    </div>
  );
};
