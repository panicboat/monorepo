import { getMediaType } from "@/lib/media";
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
    visibility: visibilityToString(p.visibility),
    name: p.name,
    handle: p.handle || "",
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
    defaultScheduleStart: p.defaultScheduleStart || "10:00",
    defaultScheduleEnd: p.defaultScheduleEnd || "22:00",
    imageUrl: p.imageUrl,
    imagePath: p.imagePath,
    avatarPath: p.avatarPath || "",
    avatarUrl: p.avatarUrl || p.imageUrl,
    images: {
      hero: p.imagePath
        ? {
            id: "hero",
            url: `/uploads/${p.imagePath}`,
            key: p.imagePath,
            type: getMediaType(p.imagePath),
          }
        : null,
      portfolio: p.images
        ? p.images.map((key, index) => ({
            id: `existing-${index}`,
            url: `/uploads/${key}`,
            key: key,
            type: getMediaType(key),
          }))
        : [],
    },
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
    handle: body.handle || "",
    bio: body.bio,
    imagePath: body.imagePath,
    tagline: body.tagline,
    areaIds: body.areaIds || [],
    genreIds: body.genreIds || [],
    defaultScheduleStart: body.defaultScheduleStart,
    defaultScheduleEnd: body.defaultScheduleEnd,
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
