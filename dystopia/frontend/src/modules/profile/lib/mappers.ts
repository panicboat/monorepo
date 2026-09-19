import type { Profile, Area, SnsLinks, BodyStats } from "@/stub/profile/v1/service_pb";
import type {
  AreaView,
  BodyStatsView,
  ProfileView,
  SaveProfilePayload,
  SnsLinksView,
} from "@/modules/profile/types";

const EMPTY_SNS: SnsLinksView = { x: "", instagram: "", tiktok: "", bluesky: "", line: "", cityheaven: "" };
const EMPTY_BODY_STATS: BodyStatsView = { heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" };

function mapSnsLinks(s: SnsLinks | undefined): SnsLinksView {
  if (!s) return { ...EMPTY_SNS };
  return {
    x: s.x || "",
    instagram: s.instagram || "",
    tiktok: s.tiktok || "",
    bluesky: s.bluesky || "",
    line: s.line || "",
    cityheaven: s.cityheaven || "",
  };
}

function mapBodyStats(b: BodyStats | undefined): BodyStatsView {
  if (!b) return { ...EMPTY_BODY_STATS };
  return {
    heightCm: b.heightCm || 0,
    bust: b.bustCm || 0,
    waist: b.waistCm || 0,
    hip: b.hipCm || 0,
    cup: b.cup || "",
  };
}

export function mapAreaToView(a: Area): AreaView {
  return {
    id: a.id,
    region: a.region || "",
    prefecture: a.prefecture || "",
    name: a.name || "",
    code: a.code || "",
  };
}

// Placeholder for the row SaveProfile upserts on first save; a fresh account has none yet.
export function emptyProfileView(accountId: string): ProfileView {
  return {
    accountId,
    username: "",
    displayName: "",
    bio: "",
    avatarMediaId: "",
    avatarUrl: "",
    coverMediaId: "",
    coverUrl: "",
    website: "",
    snsLinks: { ...EMPTY_SNS },
    prefecture: "",
    isPrivate: false,
    registeredAt: "",
    age: 0,
    bodyStats: { ...EMPTY_BODY_STATS },
    industry: "",
    areas: [],
    role: 0,
  };
}

export function mapProfileToView(p: Profile): ProfileView {
  return {
    accountId: p.accountId,
    username: p.username || "",
    displayName: p.displayName || "",
    bio: p.bio || "",
    avatarMediaId: p.avatarMediaId || "",
    avatarUrl: p.avatarUrl || "",
    coverMediaId: p.coverMediaId || "",
    coverUrl: p.coverUrl || "",
    website: p.website || "",
    snsLinks: mapSnsLinks(p.snsLinks),
    prefecture: p.prefecture || "",
    isPrivate: p.isPrivate,
    registeredAt: p.registeredAt || "",
    age: p.age || 0,
    bodyStats: mapBodyStats(p.bodyStats),
    industry: p.industry || "",
    areas: (p.areas || []).map(mapAreaToView),
    role: p.role || 0,
  };
}

export function profileViewToSavePayload(p: ProfileView): SaveProfilePayload {
  return {
    username: p.username,
    displayName: p.displayName,
    bio: p.bio,
    website: p.website,
    snsLinks: { ...p.snsLinks },
    prefecture: p.prefecture,
    isPrivate: p.isPrivate,
    age: p.age,
    bodyStats: { ...p.bodyStats },
    industry: p.industry,
    areaIds: p.areas.map((a) => a.id),
  };
}

export function buildSaveProfileRequest(payload: SaveProfilePayload) {
  const sns = payload.snsLinks;
  const stats = payload.bodyStats;
  return {
    username: payload.username || "",
    displayName: payload.displayName,
    bio: payload.bio || "",
    website: payload.website || "",
    snsLinks: {
      x: sns?.x || "",
      instagram: sns?.instagram || "",
      tiktok: sns?.tiktok || "",
      bluesky: sns?.bluesky || "",
      line: sns?.line || "",
      cityheaven: sns?.cityheaven || "",
    },
    prefecture: payload.prefecture || "",
    isPrivate: payload.isPrivate ?? false,
    age: payload.age ?? 0,
    bodyStats: {
      heightCm: stats?.heightCm ?? 0,
      bustCm: stats?.bust ?? 0,
      waistCm: stats?.waist ?? 0,
      hipCm: stats?.hip ?? 0,
      cup: stats?.cup || "",
    },
    industry: payload.industry || "",
    areaIds: payload.areaIds || [],
  };
}
