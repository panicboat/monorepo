import { CastProfile, CastVisibility } from "@/stub/portfolio/v1/cast_service_pb";

/**
 * Convert CastVisibility enum to string representation
 */
function visibilityToString(v: CastVisibility): string {
  switch (v) {
    case CastVisibility.PUBLIC:
      return "CAST_VISIBILITY_PUBLIC";
    case CastVisibility.PRIVATE:
      return "CAST_VISIBILITY_PRIVATE";
    default:
      return "CAST_VISIBILITY_UNSPECIFIED";
  }
}

/**
 * Check if cast is private (requires follow approval)
 */
export function isPrivateCast(visibility: CastVisibility): boolean {
  return visibility === CastVisibility.PRIVATE;
}

/**
 * Map gRPC CastProfile to frontend-friendly format
 */
export function mapCastProfileToFrontend(p: CastProfile) {
  return {
    id: p.id,
    userId: p.userId,
    visibility: visibilityToString(p.visibility),
    name: p.name,
    slug: p.slug || "",
    tagline: p.tagline,
    bio: p.bio,
    areas: (p.areas || []).map((a) => ({
      id: a.id,
      prefecture: a.prefecture,
      name: a.name,
      code: a.code,
    })),
    genres: (p.genres || []).map((g) => ({
      id: g.id,
      name: g.name,
      slug: g.slug,
      displayOrder: g.displayOrder,
    })),
    defaultSchedules: (p.defaultSchedules || []).length > 0
      ? p.defaultSchedules.map((ds: any) => ({ start: ds.start || "", end: ds.end || "" }))
      : [{ start: "18:00", end: "23:00" }],
    imageUrl: p.imageUrl,
    profileMediaId: p.profileMediaId || "",
    avatarMediaId: p.avatarMediaId || "",
    avatarUrl: p.avatarUrl || p.imageUrl,
    galleryMediaIds: p.galleryMediaIds || [],
    galleryUrls: p.images || [],
    tags: (p.tags || []).map((t) => ({ label: t, count: 1 })),
    socialLinks: p.socialLinks
      ? {
          x: p.socialLinks.x || "",
          instagram: p.socialLinks.instagram || "",
          tiktok: p.socialLinks.tiktok || "",
          cityheaven: p.socialLinks.cityheaven || "",
          litlink: p.socialLinks.litlink || "",
          others: p.socialLinks.others || [],
        }
      : { others: [] },
    age: p.age || undefined,
    height: p.height || undefined,
    bloodType: p.bloodType || undefined,
    threeSizes: p.threeSizes
      ? {
          b: p.threeSizes.bust || 0,
          w: p.threeSizes.waist || 0,
          h: p.threeSizes.hip || 0,
          cup: p.threeSizes.cup || "",
        }
      : undefined,
    isOnline: p.isOnline || false,
    registeredAt: p.registeredAt || null,
    isPrivate: p.visibility === CastVisibility.PRIVATE,
  };
}

/**
 * Build SaveCastProfileRequest payload from frontend body
 */
export function buildSaveProfileRequest(body: any) {
  // Convert tags from {label, count}[] to string[]
  const tagsArray = Array.isArray(body.tags)
    ? body.tags.map((t: any) => (typeof t === "string" ? t : t.label))
    : [];

  return {
    name: body.name,
    slug: body.slug || "",
    bio: body.bio,
    tagline: body.tagline,
    areaIds: body.areaIds || [],
    genreIds: body.genreIds || [],
    defaultSchedules: (body.defaultSchedules || []).map((s: any) => ({
      start: s.start,
      end: s.end,
    })),
    socialLinks: body.socialLinks
      ? {
          x: body.socialLinks.x || "",
          instagram: body.socialLinks.instagram || "",
          tiktok: body.socialLinks.tiktok || "",
          cityheaven: body.socialLinks.cityheaven || "",
          litlink: body.socialLinks.litlink || "",
          others: body.socialLinks.others || [],
        }
      : undefined,
    age: body.age || 0,
    height: body.height || 0,
    bloodType: body.bloodType || "",
    threeSizes: body.threeSizes
      ? {
          bust: body.threeSizes.b || body.threeSizes.bust || 0,
          waist: body.threeSizes.w || body.threeSizes.waist || 0,
          hip: body.threeSizes.h || body.threeSizes.hip || 0,
          cup: body.threeSizes.cup || "",
        }
      : undefined,
    tags: tagsArray,
  };
}
