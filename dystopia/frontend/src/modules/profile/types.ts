import type { Role } from "@/lib/auth";

export interface SnsLinksView {
  x: string;
  instagram: string;
  tiktok: string;
  bluesky: string;
  line: string;
  cityheaven: string;
}

export interface BodyStatsView {
  heightCm: number;
  bust: number;
  waist: number;
  hip: number;
  cup: string;
}

export interface ProfileView {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarMediaId: string;
  avatarUrl: string;
  coverMediaId: string;
  coverUrl: string;
  snsLinks: SnsLinksView;
  prefecture: string;
  area: string;
  isPrivate: boolean;
  followApprovalRequired: boolean;
  registeredAt: string;
  age: number;
  bodyStats: BodyStatsView;
  industry: string;
  role: number;
  disabled: boolean;
}

export interface CreateProfilePayload {
  displayName: string;
  username?: string;
}

export interface MyProfilesResponse {
  profiles: ProfileView[];
}

export interface SaveProfilePayload {
  username?: string;
  displayName: string;
  bio?: string;
  snsLinks?: Partial<SnsLinksView>;
  prefecture?: string;
  area?: string;
  isPrivate?: boolean;
  followApprovalRequired: boolean;
  age?: number;
  bodyStats?: Partial<BodyStatsView>;
  industry?: string;
}

export interface SaveProfileMediaPayload {
  avatarMediaId?: string;
  coverMediaId?: string;
}

export interface UsernameAvailability {
  available: boolean;
  message: string;
}

export interface ProfileSummaryView {
  profileId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  isPrivate: boolean;
  role: Role | null;
  industry: string;
}
