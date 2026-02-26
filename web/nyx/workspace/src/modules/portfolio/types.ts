export type CastStatus = "online" | "offline" | "busy" | "consulting";

export interface ServicePlan {
  id: string;
  name: string;
  duration: number; // minutes
  price: number; // 0 = Ask
  isRecommended?: boolean;
}

export interface CastImage {
  id?: string;
  url: string;
}

export interface MediaItem {
  id?: string;
  url: string;
  key?: string;
  mediaId?: string; // Media service ID for new uploads
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
  userId: string;
  name: string;
  slug?: string; // Unique user-defined ID (URL key)
  status: string; // CastStatus string for flexibility or strictly CastStatus
  message: string;
  tagline?: string; // Short catchphrase
  bio?: string; // Detailed self-intro
  isPrivate?: boolean; // Whether this cast requires follow approval

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
}

export interface DefaultSchedule {
  start: string; // HH:mm
  end: string; // HH:mm
}

export interface Genre {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
}

export type CastVisibilityType = "public" | "private";

// ----- API Response Types (raw shapes returned from BFF routes) -----

/** Social links shape shared by API responses */
export interface ApiSocialLinks {
  x?: string;
  instagram?: string;
  tiktok?: string;
  cityheaven?: string;
  litlink?: string;
  others?: string[];
}

/** Three-sizes shape in API responses (uses bust/waist/hip naming) */
export interface ApiThreeSizes {
  bust?: number;
  waist?: number;
  hip?: number;
  b?: number;
  w?: number;
  h?: number;
  cup?: string;
}

/** Profile shape returned from /api/cast/profile and /api/cast/onboarding/profile */
export interface ApiProfile {
  userId?: string;
  visibility?: string;
  name?: string;
  slug?: string;
  tagline?: string;
  bio?: string;
  areas?: { id: string; prefecture?: string; name?: string; code?: string }[];
  genres?: { id: string; name?: string; slug?: string; displayOrder?: number }[];
  defaultSchedules?: { start: string; end: string }[];
  imageUrl?: string;
  profileMediaId?: string;
  avatarMediaId?: string;
  avatarUrl?: string;
  avatarPath?: string;
  galleryMediaIds?: string[];
  galleryUrls?: string[];
  images?: string[] | { hero?: MediaItem; portfolio?: MediaItem[] };
  tags?: ({ label: string; count: number } | string)[];
  socialLinks?: ApiSocialLinks;
  age?: number;
  height?: number;
  bloodType?: string;
  threeSizes?: ApiThreeSizes;
  isOnline?: boolean;
  registeredAt?: string | null;
  isPrivate?: boolean;
}

/** Plan shape returned from API (after BFF mapping) */
export interface ApiPlan {
  id: string;
  name: string;
  price: number;
  duration?: number;
  durationMinutes?: number;
  isRecommended?: boolean;
}

/** Schedule shape returned from API (after BFF mapping) */
export interface ApiSchedule {
  date: string;
  start?: string;
  end?: string;
  startTime?: string;
  endTime?: string;
}

/** Tag shape that can be either a string or a {label, count} object */
export type ApiTag = string | { label: string; count: number };

/** Request body shape sent to the profile save endpoint */
export interface SaveProfileRequestBody {
  name?: string;
  slug?: string;
  tagline?: string;
  bio?: string;
  areaIds?: string[];
  genreIds?: string[];
  defaultSchedules?: { start: string; end: string }[];
  socialLinks?: ApiSocialLinks;
  age?: number;
  height?: number;
  bloodType?: string;
  threeSizes?: { bust: number; waist: number; hip: number; cup: string };
  tags?: ApiTag[];
  imagePath?: string;
  images?: string[];
  profileMediaId?: string;
  galleryMediaIds?: string[];
}

// ----- Form Types -----

export interface ProfileFormData {
  nickname: string;
  slug: string;
  tagline: string;
  bio: string;
  areaIds: string[];
  genreIds: string[];
  defaultSchedules: DefaultSchedule[];
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

  // Visibility setting
  isPrivate?: boolean;
}
