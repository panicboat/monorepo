export type CastStatus = "online" | "offline" | "busy" | "consulting";

export interface ServicePlan {
  id: string;
  name: string;
  duration: number; // minutes
  price: number;
}

export interface CastImage {
  id?: string;
  url: string;
}

export interface MediaItem {
  id?: string;
  url: string;
  key?: string;
  type: "image" | "video";
  thumbnail?: string;
}

export interface CastImages {
  hero: string;
  portfolio: MediaItem[];
}

export interface CastTag {
  label: string;
  count: number;
}

export interface CastProfile {
  id: string;
  name: string;
  status: string; // CastStatus string for flexibility or strictly CastStatus
  message: string;
  tagline?: string; // Short catchphrase
  bio?: string; // Detailed self-intro
  locationType?: "store" | "dispatch" | "hotel";
  area?: string;
  serviceCategory?: "advanced" | "standard" | "social";

  // Stats
  promiseRate?: number;

  // Media
  images: CastImages;

  // Metadata
  tags: CastTag[]; // Keep as CastTag[] for Profile, but FormData uses string[]
  socialLinks?: {
    x?: string;
    instagram?: string;
    tiktok?: string;
    cityheaven?: string;
    litlink?: string;
    others?: string[];
  };

  // Detailed Info
  age?: number;
  height?: number;
  bloodType?: "A" | "B" | "O" | "AB" | "Unknown";
  threeSizes?: {
    b: number;
    w: number;
    h: number;
    cup: string;
  };

  // Relations
  plans: ServicePlan[];

  // Schedule Template (Internal)
  weeklySchedules?: WeeklySchedule[];
}

export interface WeeklySchedule {
  date: string; // "YYYY-MM-DD"
  start: string;
  end: string;
  planId?: string;
}

export interface ProfileFormData {
  nickname: string;
  tagline: string;
  bio: string;
  serviceCategory: "advanced" | "standard" | "social";
  locationType: "store" | "dispatch" | "hotel";
  area: string;
  defaultScheduleStart: string; // HH:mm
  defaultScheduleEnd: string; // HH:mm
  socialLinks: {
    x?: string;
    instagram?: string;
    tiktok?: string;
    cityheaven?: string;
    litlink?: string;
    others: string[];
  };

  // Detailed Info
  age?: number;
  height?: number;
  bloodType?: "A" | "B" | "O" | "AB" | "Unknown";
  threeSizes?: {
    b: number;
    w: number;
    h: number;
    cup: string;
  };
  tags: string[];
}
