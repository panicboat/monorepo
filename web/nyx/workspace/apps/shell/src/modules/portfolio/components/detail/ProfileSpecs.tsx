"use client";

import { useSocial } from "@/modules/social/hooks/useSocial";
import { motion } from "framer-motion";

export const ProfileSpecs = ({ castId }: { castId: string }) => {
  const { isFollowing, toggleFollow } = useSocial();
  const following = isFollowing(castId);

  return (
    <div className="space-y-6 px-6 py-8 bg-white rounded-t-3xl -mt-6 relative z-10">
      {/* Header Identity */}
      <div className="text-center">
        <h1 className="text-3xl font-bold font-serif text-slate-900 mb-1 flex items-center justify-center gap-3">
          Yuna
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
        <p className="text-pink-500 text-sm font-bold tracking-widest uppercase mb-6">Platinum Cast</p>

        {/* Social Counts */}
        <div className="flex justify-center items-center gap-6 mb-6">
          <div className="flex flex-col items-center">
            <span className="font-serif font-bold text-slate-800 text-xl">1.2k</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Followers</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col items-center">
            <span className="font-serif font-bold text-slate-800 text-xl">890</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Favorites</span>
          </div>
          <div className="w-px h-8 bg-slate-100" />
          <div className="flex flex-col items-center">
            <span className="font-serif font-bold text-slate-800 text-xl">15k</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Likes</span>
          </div>
        </div>
      </div>

      {/* Introductory Text */}
      <p className="text-sm leading-relaxed text-slate-600 text-center">
        Hello! I love chatting about movies and cafes. Let's have a relaxing time together.
        Recently into tea ceremonies. 🍵
      </p>

      {/* Spec Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Age</div>
          <div className="font-medium text-slate-800">22</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Height</div>
          <div className="font-medium text-slate-800">162 cm</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Blood Type</div>
          <div className="font-medium text-slate-800">A</div>
        </div>
        <div className="space-y-1">
          <div className="text-xs font-bold text-slate-400 uppercase">Occupation</div>
          <div className="font-medium text-slate-800">Student (Art)</div>
        </div>
      </div>

      <div className="h-px bg-slate-100 my-4" />

      {/* BWH & Charm */}
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-slate-500 font-medium">B / W / H</span>
          <span className="font-bold text-slate-800">B84 (D) / W58 / H86</span>
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
        {["#EnglishOK", "#Cosplay", "#CafeHopping", "#Art"].map(tag => (
          <span key={tag} className="px-3 py-1 rounded-full bg-slate-100 text-xs text-slate-600 font-medium">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
};
