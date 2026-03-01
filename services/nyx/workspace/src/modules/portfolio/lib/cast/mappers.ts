import { ProfileFormData, MediaItem, ServicePlan, WeeklySchedule, DefaultSchedule, ApiProfile, ApiPlan, ApiSchedule, ApiTag } from "@/modules/portfolio/types";

/**
 * Map API default schedules response to DefaultSchedule array
 */
export function mapApiToDefaultSchedules(apiSchedules: { start: string; end: string }[]): DefaultSchedule[] {
  if (!apiSchedules || apiSchedules.length === 0) {
    return [{ start: "18:00", end: "23:00" }];
  }
  return apiSchedules.map((s) => ({
    start: s.start || "",
    end: s.end || "",
  }));
}

/**
 * Map API profile response to ProfileFormData
 */
export function mapApiToProfileForm(apiProfile: ApiProfile): ProfileFormData {
  const socialLinks = apiProfile.socialLinks || {};

  return {
    nickname: apiProfile.name || "",
    slug: apiProfile.slug || "",
    tagline: apiProfile.tagline || "",
    bio: apiProfile.bio || "",
    areaIds: (apiProfile.areas || []).map((a) => a.id),
    genreIds: (apiProfile.genres || []).map((g) => g.id),
    defaultSchedules: mapApiToDefaultSchedules(apiProfile.defaultSchedules || []),
    socialLinks: {
      x: socialLinks.x || "",
      instagram: socialLinks.instagram || "",
      tiktok: socialLinks.tiktok || "",
      cityheaven: socialLinks.cityheaven || "",
      litlink: socialLinks.litlink || "",
      others: socialLinks.others || [],
    },
    age: apiProfile.age || undefined,
    height: apiProfile.height || undefined,
    bloodType: apiProfile.bloodType as ProfileFormData["bloodType"],
    threeSizes: apiProfile.threeSizes
      ? {
          b: apiProfile.threeSizes.b || apiProfile.threeSizes.bust || 0,
          w: apiProfile.threeSizes.w || apiProfile.threeSizes.waist || 0,
          h: apiProfile.threeSizes.h || apiProfile.threeSizes.hip || 0,
          cup: apiProfile.threeSizes.cup || "",
        }
      : { b: 0, w: 0, h: 0, cup: "" },
    tags: apiProfile.tags?.map((t: ApiTag) => (typeof t === "string" ? t : t.label)) || [],
  };
}

/**
 * Map ProfileFormData to API request payload
 */
export function mapProfileFormToApi(form: ProfileFormData, heroKey?: string, galleryKeys?: string[]) {
  return {
    name: form.nickname,
    slug: form.slug || undefined,
    tagline: form.tagline,
    bio: form.bio,
    areaIds: form.areaIds || [],
    genreIds: form.genreIds || [],
    defaultSchedules: form.defaultSchedules.map((s) => ({
      start: s.start,
      end: s.end,
    })),
    socialLinks: form.socialLinks
      ? {
          x: form.socialLinks.x || "",
          instagram: form.socialLinks.instagram || "",
          tiktok: form.socialLinks.tiktok || "",
          cityheaven: form.socialLinks.cityheaven || "",
          litlink: form.socialLinks.litlink || "",
          others: form.socialLinks.others || [],
        }
      : undefined,
    age: form.age || 0,
    height: form.height || 0,
    bloodType: form.bloodType || "",
    threeSizes: form.threeSizes
      ? {
          bust: form.threeSizes.b || 0,
          waist: form.threeSizes.w || 0,
          hip: form.threeSizes.h || 0,
          cup: form.threeSizes.cup || "",
        }
      : undefined,
    tags: form.tags.map((t) => (typeof t === "string" ? { label: t, count: 1 } : t)),
    imagePath: heroKey,
    images: galleryKeys,
  };
}

/**
 * Map API images to MediaItem array
 */
export function mapApiToImages(apiProfile: ApiProfile): MediaItem[] {
  const images: MediaItem[] = [];

  // Hero/Profile image - use new media_id based format
  if (apiProfile.profileMediaId && apiProfile.imageUrl) {
    images.push({
      id: "hero",
      url: apiProfile.imageUrl,
      mediaId: apiProfile.profileMediaId,
      type: "image",
    });
  } else if (!Array.isArray(apiProfile.images) && apiProfile.images?.hero && typeof apiProfile.images.hero === "object") {
    images.push(apiProfile.images.hero as MediaItem);
  }

  // Gallery images - use new media_id based format
  const galleryMediaIds = apiProfile.galleryMediaIds || [];
  const galleryUrls = Array.isArray(apiProfile.images) ? apiProfile.images : [];
  if (galleryMediaIds.length > 0) {
    galleryMediaIds.forEach((mediaId: string, idx: number) => {
      images.push({
        id: `gallery-${idx}`,
        url: galleryUrls[idx] || "",
        mediaId,
        type: "image",
      });
    });
  } else if (!Array.isArray(apiProfile.images) && apiProfile.images?.portfolio) {
    images.push(...apiProfile.images.portfolio);
  }

  return images;
}

/**
 * Map API plans response to ServicePlan array
 */
export function mapApiToPlans(apiPlans: ApiPlan[]): ServicePlan[] {
  return (apiPlans || []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price ?? 0,
    duration: p.duration || p.durationMinutes || 0,
    isRecommended: p.isRecommended || false,
  }));
}

/**
 * Map ServicePlan array to API request payload
 */
export function mapPlansToApi(plans: ServicePlan[]) {
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price ?? 0,
    durationMinutes: p.duration,
    isRecommended: p.isRecommended || false,
  }));
}

/**
 * Map API schedules response to WeeklySchedule array
 */
export function mapApiToSchedules(apiSchedules: ApiSchedule[]): WeeklySchedule[] {
  return (apiSchedules || []).map((s) => ({
    date: s.date,
    start: s.start || s.startTime || "",
    end: s.end || s.endTime || "",
  }));
}

/**
 * Map WeeklySchedule array to API request payload
 */
export function mapSchedulesToApi(schedules: WeeklySchedule[]) {
  return schedules.map((s) => ({
    date: s.date,
    startTime: s.start,
    endTime: s.end,
  }));
}
