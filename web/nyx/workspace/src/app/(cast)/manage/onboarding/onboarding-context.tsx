"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { ProfileFormData } from "@/modules/portfolio/components/cast/ProfileEditForm";
import { SimplePlan } from "@/modules/ritual/components/cast/WeeklyShiftInput";
import { Shift } from "@/modules/ritual/components/cast/WeeklyShiftInput";

// Extend with mock ID for Plans
export interface PlanData extends SimplePlan {
  price: number;
  duration: number; // minutes
}

export type OnboardingData = {
  profile: ProfileFormData;
  photos: {
    cover: string | null;
    profile: string | null;
    gallery: string[];
  };
  plans: PlanData[];
  shifts: Shift[];
};

const INITIAL_DATA: OnboardingData = {
  profile: {
    nickname: "",
    tagline: "",
    bio: "",
    serviceCategory: "standard",
    locationType: "dispatch",
    area: "",
    defaultShiftStart: "18:00",
    defaultShiftEnd: "23:00",
    socialLinks: { others: [] },
  },
  photos: {
    cover: null,
    profile: null,
    gallery: [],
  },
  plans: [],
  shifts: [],
};

type OnboardingContextType = {
  data: OnboardingData;
  updateProfile: (data: Partial<ProfileFormData>) => void;
  updatePhotos: (data: Partial<OnboardingData["photos"]>) => void;
  setPlans: (plans: PlanData[]) => void;
  setShifts: (shifts: Shift[]) => void;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<OnboardingData>(INITIAL_DATA);

  const updateProfile = (profileData: Partial<ProfileFormData>) => {
    setData((prev) => ({
      ...prev,
      profile: { ...prev.profile, ...profileData },
    }));
  };

  const updatePhotos = (photosData: Partial<OnboardingData["photos"]>) => {
    setData((prev) => ({
      ...prev,
      photos: { ...prev.photos, ...photosData },
    }));
  };

  const setPlans = (plans: PlanData[]) => {
    setData((prev) => ({ ...prev, plans }));
  };

  const setShifts = (shifts: Shift[]) => {
    setData((prev) => ({ ...prev, shifts }));
  };

  return (
    <OnboardingContext.Provider
      value={{ data, updateProfile, updatePhotos, setPlans, setShifts }}
    >
      {children}
    </OnboardingContext.Provider>
  );
};

export const useOnboarding = () => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
};
