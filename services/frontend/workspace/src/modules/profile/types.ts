export interface SnsLinksView {
  x: string;
  instagram: string;
  tiktok: string;
  bluesky: string;
  line: string;
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
  heightCm: number;
  cupSize: string;
  industry: string;
  areas: AreaView[];
  shopId: string;
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
  heightCm?: number;
  cupSize?: string;
  industry?: string;
  areaIds?: string[];
  shopId?: string;
}

export interface SaveProfileMediaPayload {
  avatarMediaId?: string;
  coverMediaId?: string;
}

export interface UsernameAvailability {
  available: boolean;
  message: string;
}
