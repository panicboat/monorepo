"use client";

import { useSocial } from "@/modules/social/hooks/useSocial";
import { motion } from "motion/react";

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
      socialLinks: data.socialLinks,
    };
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
  const socialLinks = display?.socialLinks;

  return (
    <div className="space-y-6 px-6 py-8 bg-surface rounded-t-3xl -mt-6 relative z-10">
      {/* Header Identity */}
      <div className="text-center">
        <h1 className="text-3xl font-bold font-serif text-text-primary mb-1 flex items-center justify-center gap-3">
          {name}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleFollow(castId)}
            className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${
              following
                ? "bg-surface-secondary text-text-secondary border-border"
                : "bg-surface text-role-cast border-role-cast hover:bg-role-cast-lighter"
            }`}
          >
            {following ? "Following" : "Follow"}
          </motion.button>
        </h1>

        {/* One Liner Bubble */}
        {tagline && (
          <div className="relative inline-block bg-surface-secondary border border-border rounded-2xl px-4 py-2 mb-6 mx-auto">
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-surface-secondary border-t border-l border-border transform rotate-45" />
            <p className="text-sm italic text-text-secondary">{tagline}</p>
          </div>
        )}

        {/* TODO: Social Counts - implement backend data source */}
      </div>

      {/* Introductory Text */}
      {bio && (
        <p className="text-sm leading-relaxed text-text-secondary text-center whitespace-pre-wrap">
          {bio}
        </p>
      )}

      {/* Spec Grid - Only show if we have data */}
      {(age || height || bloodType) && (
        <>
          <div className="grid grid-cols-3 gap-4 text-sm text-center">
            {age && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-text-muted uppercase">
                  Age
                </div>
                <div className="font-medium text-text-primary">{age}</div>
              </div>
            )}
            {height && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-text-muted uppercase">
                  Height
                </div>
                <div className="font-medium text-text-primary">{height} cm</div>
              </div>
            )}
            {bloodType && (
              <div className="space-y-1">
                <div className="text-xs font-bold text-text-muted uppercase">
                  Blood Type
                </div>
                <div className="font-medium text-text-primary">{bloodType}</div>
              </div>
            )}
          </div>
          <div className="h-px bg-surface-secondary my-4" />
        </>
      )}

      {/* BWH */}
      {bwh && (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary font-medium">B / W / H</span>
            <span className="font-bold text-text-primary">{bwh}</span>
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
            <div className="text-xs font-bold text-text-muted uppercase mb-3">
              Social
            </div>
            <div className="flex flex-wrap gap-2">
              {socialLinks.x && (
                <a
                  href={`https://x.com/${socialLinks.x}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition"
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
                  className="px-3 py-1 rounded-full bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition"
                >
                  TikTok
                </a>
              )}
              {socialLinks.litlink && (
                <a
                  href={`https://lit.link/${socialLinks.litlink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-info text-white text-xs font-medium hover:bg-info-hover transition"
                >
                  lit.link
                </a>
              )}
              {socialLinks.cityheaven && (
                <a
                  href={socialLinks.cityheaven}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1 rounded-full bg-role-cast text-white text-xs font-medium hover:bg-role-cast-hover transition"
                >
                  CityHeaven
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
              className="px-3 py-1 rounded-full bg-surface-secondary text-xs text-text-secondary font-medium"
            >
              {tag.startsWith("#") ? tag : `#${tag}`}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
