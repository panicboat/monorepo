"use client";

import { motion } from "framer-motion";
import { useState } from "react";

// Mock Images
// Mock Images Map
const MOCK_GALLERIES: Record<string, string[]> = {
  "1": [ // Yuna
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    "https://placehold.co/600x800/pink/white?text=Yuna+Selfie",
    "https://placehold.co/600x800/orange/white?text=Yuna+OOTD",
  ],
  "2": [ // Maria
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    "https://placehold.co/600x800/blue/white?text=Maria+Date",
    "https://placehold.co/600x800/cyan/white?text=Maria+Cosplay",
  ],
  "3": [ // Sarah
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    "https://placehold.co/600x800/green/white?text=Sarah+Nature",
  ],
  // Fallback
  "default": [
    "https://placehold.co/600x800/gray/white?text=No+Image",
  ]
};

export const PhotoGallery = ({ castId }: { castId: string }) => {
  const images = MOCK_GALLERIES[castId] || MOCK_GALLERIES["default"];
  const [current, setCurrent] = useState(0);

  return (
    <div className="relative h-[65vh] w-full bg-slate-200">
      {/* Main Image Slider */}
      <div className="h-full w-full overflow-hidden">
        <motion.img
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          src={images[current]}
          className="h-full w-full object-cover"
          alt="Cast Portrait"
        />
      </div>

      {/* Gradient Overlay for Text Visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent pointer-events-none"></div>

      {/* Thumbnails / Indicators */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
        {images.map((_, idx) => (
          <button
            key={idx}
            onClick={() => setCurrent(idx)}
            className={`h-2 rounded-full transition-all ${idx === current ? "w-6 bg-white" : "w-2 bg-white/50"}`}
          />
        ))}
      </div>

      {/* Status Badge */}
      <div className="absolute top-4 left-4 flex gap-2">
        <span className="flex items-center gap-1 rounded-full bg-green-500/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-md shadow-sm border border-green-400/50">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white"></span>
          Online
        </span>
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/20">
          Tonight OK
        </span>
      </div>
    </div>
  );
};
