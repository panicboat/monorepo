"use client";

import { useSocial } from "@/modules/social/hooks/useSocial";
import { motion } from "framer-motion";

import { CastProfile, ProfileFormData } from "@/modules/portfolio/types";

// Helper to normalize data
const getDisplayData = (data?: CastProfile | ProfileFormData) => {
  if (!data) return null;

  // Type Guard or simple check
  const isForm = (d: any): d is ProfileFormData => 'nickname' in d;

  if (isForm(data)) {
    return {
      name: data.nickname,
      tagline: data.tagline,
      bio: data.bio,
      age: data.age,
      height: data.height,
      bloodType: data.bloodType,
      occupation: "Unavailable", // Not in form yet
      bwh: `B${data.threeSizes?.b || '?'} (${data.threeSizes?.cup || '?'}) / W${data.threeSizes?.w || '?'} / H${data.threeSizes?.h || '?'}`,
      tags: data.tags,
      location: data.area,
      social: data.socialLinks
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
      occupation: "Onboarding...",
      bwh: `B${data.threeSizes?.b || '?'} (${data.threeSizes?.cup || '?'}) / W${data.threeSizes?.w || '?'} / H${data.threeSizes?.h || '?'}`,
      tags: data.tags?.map(t => t.label) || [],
      location: data.area,
      social: data.socialLinks
    };
  }
}

export const ProfileSpecs = ({ castId, profileData }: { castId: string; profileData?: CastProfile | ProfileFormData }) => {
  const { isFollowing, toggleFollow } = useSocial();
  const following = isFollowing(castId);

  const display = getDisplayData(profileData);

  // If no profileData, use the existing hardcoded mock (Yuna) for backward compat or implement a mock lookup
  // For now, let's allow overrides. If display exists, use it.

  const name = display?.name || "Yuna";
  const tagline = display?.tagline || '"Just finished a ritual! 🕯️ Available for a chat."';
  const bio = display?.bio || "Hello! I love chatting about movies and cafes. Let's have a relaxing time together.\nRecently into tea ceremonies. 🍵";
  const age = display?.age || 22;
  const height = display?.height || 162;
  const bloodType = display?.bloodType || "A";
  const occupation = display?.occupation || "Student (Art)";
  const bwh = display?.bwh || "B84 (D) / W58 / H86";
  const tags = display?.tags || ["#EnglishOK", "#Cosplay", "#CafeHopping", "#Art"];

  return (
    <div className="space-y-6 px-6 py-8 bg-white rounded-t-3xl -mt-6 relative z-10">
      {/* Header Identity */}
      <div className="text-center">
        <h1 className="text-3xl font-bold font-serif text-slate-900 mb-1 flex items-center justify-center gap-3">
          {name}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleFollow(castId)}
            className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${following
              ? "bg-slate-100 text-slate-500 border-slate-200"
              : "bg-white text-pink-500 border-pink-500 hover:bg-pink-50"
              }`}
          >
            {following ? "Following" : "Follow"}
          </motion.button>
        </h1>
        <p className="text-pink-500 text-sm font-bold tracking-widest uppercase mb-4">Platinum Cast</p>

        {/* One Liner Bubble */}
        <div className="relative inline-block bg-slate-50 border border-slate-100 rounded-2xl px-4 py-2 mb-6 mx-auto">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-50 border-t border-l border-slate-100 transform rotate-45" />
          <p className="text-sm italic text-slate-700">{tagline}</p>
        </div>

        {/* Social Counts */}
        <div className="flex justify-center items-center gap-4 mb-8">
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="font-serif font-bold text-slate-800 text-xl">1.2k</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Followers</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="font-serif font-bold text-slate-800 text-xl">890</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Favorites</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="font-serif font-bold text-slate-800 text-xl">15k</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Likes</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col items-center min-w-[60px]">
            <span className="font-serif font-bold text-slate-800 text-xl">100<span className="text-xs">%</span></span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Etiquette</span>
            <span className="text-[9px] text-slate-300 font-mono">(120/120)</span>
          </div>
        </div>
      </div>

      {/* Introductory Text */}
      <p className="text-sm leading-relaxed text-slate-600 text-center whitespace-pre-wrap">
        {bio}
      </p>

      {/* Spec Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Age</div>
          <div className="font-medium text-slate-800">{age}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Height</div>
          <div className="font-medium text-slate-800">{height} cm</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Blood Type</div>
          <div className="font-medium text-slate-800">{bloodType}</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Occupation</div>
          <div className="font-medium text-slate-800">{occupation}</div>
        </div>
      </div>

      <div className="h-px bg-slate-100 my-4" />

      {/* BWH & Charm */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500 font-medium">B / W / H</span>
          <span className="font-bold text-slate-800">{bwh}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500 font-medium">Charm Point</span>
          <span className="font-bold text-slate-800">Dimples / Voice</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500 font-medium">Personality</span>
          <span className="font-bold text-slate-800">Calm, Good Listener</span>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 pt-2">
        {tags.map(tag => (
          <span key={tag} className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-600 font-medium">
            {tag}
          </span>
        ))}
      </div>
    </div >
  );
};
