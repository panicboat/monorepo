import type { Profile, ProfileSummary, SnsLinks, BodyStats } from "@/stub/profile/v1/service_pb";
import type {
  BodyStatsView,
  ProfileSummaryView,
  ProfileView,
  SaveProfilePayload,
  SnsLinksView,
} from "@/modules/profile/types";

const EMPTY_SNS: SnsLinksView = { x: "", instagram: "", tiktok: "", bluesky: "", litlink: "", cityheaven: "" };
const EMPTY_BODY_STATS: BodyStatsView = { heightCm: 0, bust: 0, waist: 0, hip: 0, cup: "" };

function mapSnsLinks(s: SnsLinks | undefined): SnsLinksView {
  if (!s) return { ...EMPTY_SNS };
  return {
    x: s.x || "",
    instagram: s.instagram || "",
    tiktok: s.tiktok || "",
    bluesky: s.bluesky || "",
    litlink: s.litlink || "",
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

export function emptyProfileView(id: string): ProfileView {
  return {
    id,
    username: "",
    displayName: "",
    bio: "",
    avatarMediaId: "",
    avatarUrl: "",
    coverMediaId: "",
    coverUrl: "",
    snsLinks: { ...EMPTY_SNS },
    prefecture: "",
    area: "",
    isPrivate: false,
    followApprovalRequired: false,
    registeredAt: "",
    age: 0,
    bodyStats: { ...EMPTY_BODY_STATS },
    industry: "",
    role: 0,
    disabled: false,
  };
}

export function mapProfileToView(p: Profile): ProfileView {
  return {
    id: p.id,
    username: p.username || "",
    displayName: p.displayName || "",
    bio: p.bio || "",
    avatarMediaId: p.avatarMediaId || "",
    avatarUrl: p.avatarUrl || "",
    coverMediaId: p.coverMediaId || "",
    coverUrl: p.coverUrl || "",
    snsLinks: mapSnsLinks(p.snsLinks),
    prefecture: p.prefecture || "",
    area: p.area || "",
    isPrivate: p.isPrivate,
    followApprovalRequired: p.followApprovalRequired,
    registeredAt: p.registeredAt || "",
    age: p.age || 0,
    bodyStats: mapBodyStats(p.bodyStats),
    industry: p.industry || "",
    role: p.role || 0,
    disabled: p.disabled,
  };
}

export function buildSaveProfileRequest(payload: SaveProfilePayload) {
  const sns = payload.snsLinks;
  const stats = payload.bodyStats;
  return {
    username: payload.username || "",
    displayName: payload.displayName,
    bio: payload.bio || "",
    snsLinks: {
      x: sns?.x || "",
      instagram: sns?.instagram || "",
      tiktok: sns?.tiktok || "",
      bluesky: sns?.bluesky || "",
      litlink: sns?.litlink || "",
      cityheaven: sns?.cityheaven || "",
    },
    prefecture: payload.prefecture || "",
    area: payload.area || "",
    isPrivate: payload.isPrivate ?? false,
    followApprovalRequired: payload.followApprovalRequired,
    age: payload.age ?? 0,
    bodyStats: {
      heightCm: stats?.heightCm ?? 0,
      bustCm: stats?.bust ?? 0,
      waistCm: stats?.waist ?? 0,
      hipCm: stats?.hip ?? 0,
      cup: stats?.cup || "",
    },
    industry: payload.industry || "",
  };
}

const ROLE_BY_NUMBER: Record<number, ProfileSummaryView["role"]> = { 1: "guest", 2: "cast" };

export function summaryToView(summary: ProfileSummary): ProfileSummaryView {
  return {
    profileId: summary.profileId,
    username: summary.username,
    displayName: summary.displayName,
    avatarUrl: summary.avatarUrl,
    isPrivate: !!summary.isPrivate,
    role: ROLE_BY_NUMBER[summary.role] ?? null,
    industry: summary.industry || "",
  };
}
