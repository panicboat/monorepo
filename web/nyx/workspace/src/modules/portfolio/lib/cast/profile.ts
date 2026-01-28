import { getMediaType } from "@/lib/media";
import { CastProfile, CastVisibility } from "@/stub/portfolio/v1/service_pb";

/**
 * Convert CastVisibility enum to string representation
 */
function visibilityToString(v: CastVisibility): string {
  switch (v) {
    case CastVisibility.UNREGISTERED:
      return "CAST_VISIBILITY_UNREGISTERED";
    case CastVisibility.UNPUBLISHED:
      return "CAST_VISIBILITY_UNPUBLISHED";
    case CastVisibility.PUBLISHED:
      return "CAST_VISIBILITY_PUBLISHED";
    default:
      return "CAST_VISIBILITY_UNSPECIFIED";
  }
}

/**
 * Map gRPC CastProfile to frontend-friendly format
 */
export function mapCastProfileToFrontend(p: CastProfile) {
  return {
    visibility: visibilityToString(p.visibility),
    name: p.name,
    tagline: p.tagline,
    bio: p.bio,
    area: p.area || "",
    serviceCategory: p.serviceCategory || "standard",
    locationType: p.locationType || "dispatch",
    defaultScheduleStart: p.defaultScheduleStart || "18:00",
    defaultScheduleEnd: p.defaultScheduleEnd || "23:00",
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
    bio: body.bio,
    imagePath: body.imagePath,
    tagline: body.tagline,
    serviceCategory: body.serviceCategory,
    locationType: body.locationType,
    area: body.area,
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
