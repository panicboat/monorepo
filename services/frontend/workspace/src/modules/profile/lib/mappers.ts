import type { Profile, Area, SnsLinks } from "@/stub/profile/v1/service_pb";
import type {
  AreaView,
  ProfileView,
  SaveProfilePayload,
  SnsLinksView,
} from "@/modules/profile/types";

const EMPTY_SNS: SnsLinksView = { x: "", instagram: "", tiktok: "", bluesky: "", line: "" };

function mapSnsLinks(s: SnsLinks | undefined): SnsLinksView {
  if (!s) return { ...EMPTY_SNS };
  return {
    x: s.x || "",
    instagram: s.instagram || "",
    tiktok: s.tiktok || "",
    bluesky: s.bluesky || "",
    line: s.line || "",
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
    heightCm: p.heightCm || 0,
    cupSize: p.cupSize || "",
    industry: p.industry || "",
    areas: (p.areas || []).map(mapAreaToView),
    shopId: p.shopId || "",
  };
}

export function buildSaveProfileRequest(payload: SaveProfilePayload) {
  const sns = payload.snsLinks;
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
    },
    prefecture: payload.prefecture || "",
    isPrivate: payload.isPrivate ?? false,
    age: payload.age ?? 0,
    heightCm: payload.heightCm ?? 0,
    cupSize: payload.cupSize || "",
    industry: payload.industry || "",
    areaIds: payload.areaIds || [],
    shopId: payload.shopId || "",
  };
}
