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
  hero: string | MediaItem | null;
  portfolio: MediaItem[];
  avatarUrl?: string;
  avatarPath?: string;
}

export interface CastTag {
  label: string;
  count: number;
}

export interface Area {
  id: string;
  prefecture: string;
  name: string;
  code: string;
}

export interface CastProfile {
  id: string;
  name: string;
  handle?: string; // Unique user-defined ID (URL key)
  status: string; // CastStatus string for flexibility or strictly CastStatus
  message: string;
  tagline?: string; // Short catchphrase
  bio?: string; // Detailed self-intro

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

  // Areas (selected from master)
  areas?: Area[];

  // Schedule Template (Internal)
  weeklySchedules?: WeeklySchedule[];
}

export interface WeeklySchedule {
  date: string; // "YYYY-MM-DD"
  start: string;
  end: string;
  planId?: string;
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
}

export interface ProfileFormData {
  nickname: string;
  handle: string;
  tagline: string;
  bio: string;
  areaIds: string[];
  genreIds: string[];
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
