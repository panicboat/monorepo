"use client";

import { useSocial } from "@/modules/social/hooks/useSocial";
import { motion } from "motion/react";
import { MapPin, Clock, Briefcase } from "lucide-react";

import { CastProfile, ProfileFormData } from "@/modules/portfolio/types";

// Helper to normalize data
const getDisplayData = (data?: CastProfile | ProfileFormData) => {
  if (!data) return null;

  // Type Guard or simple check
  const isForm = (d: any): d is ProfileFormData => "nickname" in d;

  if (isForm(data)) {
    return {
      name: data.nickname,
      tagline: data.tagline,
      bio: data.bio,
      age: data.age,
      height: data.height,
      bloodType: data.bloodType,
      bwh:
        data.threeSizes?.b || data.threeSizes?.w || data.threeSizes?.h
          ? `B${data.threeSizes.b || "?"} (${data.threeSizes.cup || "?"}) / W${data.threeSizes.w || "?"} / H${data.threeSizes.h || "?"}`
          : null,
      tags: data.tags,
      area: data.area,
      locationType: data.locationType,
      serviceCategory: data.serviceCategory,
      socialLinks: data.socialLinks,
    };
  } else {
    // CastProfile
    return {
      name: data.name,
      tagline: data.tagline,
      bio: data.bio,
      age: data.age,
      height: data.height,
      bloodType: data.bloodType,
      bwh:
        data.threeSizes?.b || data.threeSizes?.w || data.threeSizes?.h
          ? `B${data.threeSizes.b || "?"} (${data.threeSizes.cup || "?"}) / W${data.threeSizes.w || "?"} / H${data.threeSizes.h || "?"}`
          : null,
      tags: data.tags?.map((t) => t.label) || [],
      area: data.area,
      locationType: data.locationType,
      serviceCategory: data.serviceCategory,
      socialLinks: data.socialLinks,
    };
  }
};

// Helper for locationType display
const getLocationTypeLabel = (type?: string) => {
  switch (type) {
    case "store":
      return "店舗";
    case "dispatch":
      return "派遣";
    case "hotel":
      return "ホテル";
    default:
      return null;
  }
};

// Helper for serviceCategory display
const getServiceCategoryLabel = (category?: string) => {
  switch (category) {
    case "advanced":
      return "Advanced";
    case "standard":
      return "Standard";
    case "social":
      return "Social";
    default:
      return null;
  }
};

export const ProfileSpecs = ({
  castId,
  profileData,
}: {
  castId: string;
  profileData?: CastProfile | ProfileFormData;
}) => {
  const { isFollowing, toggleFollow } = useSocial();
  const following = isFollowing(castId);

  const display = getDisplayData(profileData);

  const name = display?.name || "Cast";
  const tagline = display?.tagline || "";
  const bio = display?.bio || "";
  const age = display?.age;
  const height = display?.height;
  const bloodType = display?.bloodType;
  const bwh = display?.bwh;
  const tags = display?.tags || [];
  const area = display?.area;
  const locationType = getLocationTypeLabel(display?.locationType);
  const serviceCategory = getServiceCategoryLabel(display?.serviceCategory);
  const socialLinks = display?.socialLinks;

  return (
    <div className="space-y-6 px-6 py-8 bg-white rounded-t-3xl -mt-6 relative z-10">
      {/* Header Identity */}
      <div className="text-center">
        <h1 className="text-3xl font-bold font-serif text-slate-900 mb-1 flex items-center justify-center gap-3">
          {name}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleFollow(castId)}
            className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${
              following
                ? "bg-slate-100 text-slate-500 border-slate-200"
                : "bg-white text-pink-500 border-pink-500 hover:bg-pink-50"
            }`}
          >
            {following ? "Following" : "Follow"}
          </motion.button>
        </h1>

        {serviceCategory && (
          <p className="text-pink-500 text-sm font-bold tracking-widest uppercase mb-4">
            {serviceCategory} Cast
          </p>
        )}

        {/* One Liner Bubble */}
        {tagline && (
          <div className="relative inline-block bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 mb-6 mx-auto">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-50 border-t border-l border-slate-100 transform rotate-45" />
            <p className="text-sm italic text-slate-700">{tagline}</p>
          </div>
        )}

        {/* Location & Service Info */}
        {(area || locationType) && (
          <div className="flex justify-center items-center gap-4 mb-6 text-sm text-slate-500">
            {area && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{area}</span>
              </div>
            )}
            {locationType && (
              <div className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                <span>{locationType}</span>
              </div>
            )}
          </div>
        )}

        {/* TODO: Social Counts - implement backend data source */}
      </div>

      {/* Introductory Text */}
      {bio && (
        <p className="text-sm leading-relaxed text-slate-600 text-center whitespace-pre-wrap">
          {bio}
        </p>
      )}

      {/* Spec Grid - Only show if we have data */}
      {(age || height || bloodType) && (
        <>
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            {age && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-400 uppercase">
                  Age
                </div>
                <div className="font-medium text-slate-800">{age}</div>
              </div>
            )}
            {height && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-400 uppercase">
                  Height
                </div>
                <div className="font-medium text-slate-800">{height} cm</div>
              </div>
            )}
            {bloodType && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-400 uppercase">
                  Blood Type
                </div>
                <div className="font-medium text-slate-800">{bloodType}</div>
              </div>
            )}
          </div>
          <div className="h-px bg-slate-100 my-4" />
        </>
      )}

      {/* BWH */}
      {bwh && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-500 font-medium">B / W / H</span>
            <span className="font-bold text-slate-800">{bwh}</span>
          </div>
        </div>
      )}

      {/* Social Links */}
      {socialLinks &&
        (socialLinks.x ||
          socialLinks.instagram ||
          socialLinks.tiktok ||
          socialLinks.cityheaven ||
          socialLinks.litlink) && (
          <div className="pt-4">
            <div className="text-xs font-bold text-slate-400 uppercase mb-3">
              Social
            </div>
            <div className="flex flex-wrap gap-2">
              {socialLinks.x && (
                <a
                  href={`https://x.com/${socialLinks.x}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition"
                >
                  X
                </a>
              )}
              {socialLinks.instagram && (
                <a
                  href={`https://instagram.com/${socialLinks.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-medium hover:opacity-90 transition"
                >
                  Instagram
                </a>
              )}
              {socialLinks.tiktok && (
                <a
                  href={`https://tiktok.com/@${socialLinks.tiktok}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition"
                >
                  TikTok
                </a>
              )}
              {socialLinks.cityheaven && (
                <a
                  href={socialLinks.cityheaven}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-pink-500 text-white text-xs font-medium hover:bg-pink-600 transition"
                >
                  CityHeaven
                </a>
              )}
              {socialLinks.litlink && (
                <a
                  href={socialLinks.litlink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition"
                >
                  Litlink
                </a>
              )}
            </div>
          </div>
        )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-600 font-medium"
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
