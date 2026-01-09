"use client";

import { motion } from "framer-motion";
import { useState } from "react";

// Mock Images
// Mock Images Map
const MOCK_GALLERIES: Record<string, string[]> = {
  "1": [
    // Yuna
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    "https://placehold.co/600x800/pink/white?text=Yuna+Selfie",
    "https://placehold.co/600x800/orange/white?text=Yuna+OOTD",
  ],
  "2": [
    // Maria
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    "https://placehold.co/600x800/blue/white?text=Maria+Date",
    "https://placehold.co/600x800/cyan/white?text=Maria+Cosplay",
  ],
  "3": [
    // Sarah
    "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    "https://placehold.co/600x800/green/white?text=Sarah+Nature",
  ],
  // Fallback
  default: ["https://placehold.co/600x800/gray/white?text=No+Image"],
};

export const PhotoGallery = ({
  castId,
  images: propImages,
}: {
  castId: string;
  images?: string[];
}) => {
  const images =
    propImages || MOCK_GALLERIES[castId] || MOCK_GALLERIES["default"];
  const [current, setCurrent] = useState(0);

  // Swipe Logic
  const swipeConfidenceThreshold = 10000;
  const swipePower = (offset: number, velocity: number) => {
    return Math.abs(offset) * velocity;
  };

  const paginate = (newDirection: number) => {
    let nextIndex = current + newDirection;
    if (nextIndex < 0) nextIndex = 0;
    if (nextIndex >= images.length) nextIndex = images.length - 1;
    setCurrent(nextIndex);
  };

  return (
    <div className="relative h-[65vh] w-full bg-slate-900 overflow-hidden">
      {/* Disclaimer / Status Badge */}
      <div className="absolute top-4 left-4 z-20 flex gap-2">
        <span className="flex items-center gap-1 rounded-full bg-green-500/90 px-3 py-1 text-xs font-bold text-white backdrop-blur-md shadow-sm border border-green-400/50">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white"></span>
          Online
        </span>
        <span className="rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white backdrop-blur-md border border-white/20">
          Tonight OK
        </span>
      </div>

      {/* Main Image Slider */}
      <motion.div
        className="flex h-full w-full"
        animate={{ x: `-${current * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, { offset, velocity }) => {
          const swipe = swipePower(offset.x, velocity.x);

          if (swipe < -swipeConfidenceThreshold) {
            paginate(1);
          } else if (swipe > swipeConfidenceThreshold) {
            paginate(-1);
          }
        }}
      >
        {images.map((src, index) => (
          <div key={index} className="h-full w-full flex-shrink-0 relative">
            <img
              src={src}
              className="h-full w-full object-cover"
              alt={`Cast Portrait ${index + 1}`}
              draggable="false"
            />
            {/* Gradient Overlay for Text Visibility (Per Image) */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none"></div>
          </div>
        ))}
      </motion.div>

      {/* Top Indicators (Story style - Static) */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-2">
        {images.map((_, idx) => (
          <div
            key={idx}
            className="h-1 flex-1 rounded-full bg-white/20 overflow-hidden backdrop-blur-sm"
          >
            <div
              className={`h-full bg-white transition-opacity duration-300 ${
                idx === current ? "opacity-100" : "opacity-30"
              }`}
            />
          </div>
        ))}
      </div>

      {/* Left/Right Tap Areas (Invisible) */}
      <div
        className="absolute inset-y-0 left-0 w-1/4 z-10"
        onClick={() => paginate(-1)}
      />
      <div
        className="absolute inset-y-0 right-0 w-1/4 z-10"
        onClick={() => paginate(1)}
      />
    </div>
  );
};
