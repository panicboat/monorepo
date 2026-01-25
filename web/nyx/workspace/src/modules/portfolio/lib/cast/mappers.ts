import { getMediaType } from "@/lib/media";
import { ProfileFormData, MediaItem, ServicePlan, WeeklySchedule } from "@/modules/portfolio/types";

/**
 * Map API profile response to ProfileFormData
 */
export function mapApiToProfileForm(apiProfile: any): ProfileFormData {
  const socialLinks = apiProfile.socialLinks || {};

  return {
    nickname: apiProfile.name || "",
    tagline: apiProfile.tagline || "",
    bio: apiProfile.bio || "",
    serviceCategory: apiProfile.serviceCategory || "standard",
    locationType: apiProfile.locationType || "dispatch",
    area: apiProfile.area || "",
    defaultScheduleStart: apiProfile.defaultScheduleStart || "18:00",
    defaultScheduleEnd: apiProfile.defaultScheduleEnd || "23:00",
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
    bloodType: apiProfile.bloodType || undefined,
    threeSizes: apiProfile.threeSizes
      ? {
          b: apiProfile.threeSizes.b || apiProfile.threeSizes.bust || 0,
          w: apiProfile.threeSizes.w || apiProfile.threeSizes.waist || 0,
          h: apiProfile.threeSizes.h || apiProfile.threeSizes.hip || 0,
          cup: apiProfile.threeSizes.cup || "",
        }
      : { b: 0, w: 0, h: 0, cup: "" },
    tags: apiProfile.tags?.map((t: any) => (typeof t === "string" ? t : t.label)) || [],
  };
}

/**
 * Map ProfileFormData to API request payload
 */
export function mapProfileFormToApi(form: ProfileFormData, heroKey?: string, galleryKeys?: string[]) {
  return {
    name: form.nickname,
    tagline: form.tagline,
    bio: form.bio,
    area: form.area,
    serviceCategory: form.serviceCategory,
    locationType: form.locationType,
    defaultScheduleStart: form.defaultScheduleStart,
    defaultScheduleEnd: form.defaultScheduleEnd,
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
export function mapApiToImages(apiProfile: any): MediaItem[] {
  const images: MediaItem[] = [];

  // Hero image
  if (apiProfile.images?.hero && typeof apiProfile.images.hero === "object") {
    images.push(apiProfile.images.hero as MediaItem);
  } else if (apiProfile.imagePath) {
    images.push({
      id: "hero",
      url: `/uploads/${apiProfile.imagePath}`,
      key: apiProfile.imagePath,
      type: getMediaType(apiProfile.imagePath),
    });
  }

  // Portfolio images
  if (apiProfile.images?.portfolio) {
    images.push(...apiProfile.images.portfolio);
  }

  return images;
}

/**
 * Map API plans response to ServicePlan array
 */
export function mapApiToPlans(apiPlans: any[]): ServicePlan[] {
  return (apiPlans || []).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    duration: p.duration || p.durationMinutes,
  }));
}

/**
 * Map ServicePlan array to API request payload
 */
export function mapPlansToApi(plans: ServicePlan[]) {
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    durationMinutes: p.duration,
  }));
}

/**
 * Map API schedules response to WeeklySchedule array
 */
export function mapApiToSchedules(apiSchedules: any[]): WeeklySchedule[] {
  return (apiSchedules || []).map((s) => ({
    date: s.date,
    start: s.start || s.startTime,
    end: s.end || s.endTime,
    planId: s.planId,
  }));
}

/**
 * Map WeeklySchedule array to API request payload
 */
export function mapSchedulesToApi(schedules: WeeklySchedule[], validPlanIds?: Set<string>) {
  return schedules.map((s) => {
    const planId = validPlanIds && s.planId && validPlanIds.has(s.planId) ? s.planId : s.planId;
    return {
      date: s.date,
      startTime: s.start,
      endTime: s.end,
      planId,
    };
  });
}
