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

export interface AreaView {
  id: string;
  region: string;
  prefecture: string;
  name: string;
  code: string;
}

export interface ProfileView {
  accountId: string;
  username: string;
  displayName: string;
  bio: string;
  avatarMediaId: string;
  avatarUrl: string;
  coverMediaId: string;
  coverUrl: string;
  website: string;
  snsLinks: SnsLinksView;
  prefecture: string;
  isPrivate: boolean;
  registeredAt: string;
  age: number;
  bodyStats: BodyStatsView;
  industry: string;
  areas: AreaView[];
  role: number; // identity role mirror: 1 = GUEST, 2 = CAST, 0 = unknown
}

export interface SaveProfilePayload {
  username?: string;
  displayName: string;
  bio?: string;
  website?: string;
  snsLinks?: Partial<SnsLinksView>;
  prefecture?: string;
  isPrivate?: boolean;
  age?: number;
  bodyStats?: Partial<BodyStatsView>;
  industry?: string;
  areaIds?: string[];
}

export interface SaveProfileMediaPayload {
  avatarMediaId?: string;
  coverMediaId?: string;
}

export interface UsernameAvailability {
  available: boolean;
  message: string;
}
