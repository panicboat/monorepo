"use client";

import { motion } from "motion/react";
import { useState, useRef } from "react";
import { MediaItem } from "@/modules/portfolio/types";
import { Play, X, Volume2 } from "lucide-react";

// Mock Images Map
const MOCK_GALLERIES: Record<string, MediaItem[]> = {
  "1": [
    // Yuna
    {
      type: "image",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    },
    {
      type: "video",
      url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
      thumbnail: "https://placehold.co/600x800/pink/white?text=Yuna+Video",
    },
    {
      type: "image",
      url: "https://placehold.co/600x800/pink/white?text=Yuna+Selfie",
    },
    {
      type: "image",
      url: "https://placehold.co/600x800/orange/white?text=Yuna+OOTD",
    },
  ],
  "2": [
    // Maria
    {
      type: "image",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    },
    {
      type: "image",
      url: "https://placehold.co/600x800/blue/white?text=Maria+Date",
    },
    {
      type: "image",
      url: "https://placehold.co/600x800/cyan/white?text=Maria+Cosplay",
    },
  ],
  "3": [
    // Sarah
    {
      type: "image",
      url: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    },
    {
      type: "image",
      url: "https://placehold.co/600x800/green/white?text=Sarah+Nature",
    },
  ],
  // Fallback
  default: [
    { type: "image", url: "https://placehold.co/600x800/gray/white?text=No+Image" },
  ],
};

export const PhotoGallery = ({
  castId,
  images: propImages,
}: {
  castId: string;
  images?: MediaItem[];
}) => {
  // If propImages is string[] (legacy/failed migration), map to MediaItem
  // But we enforce MediaItem[] now.
  const images =
    propImages || MOCK_GALLERIES[castId] || MOCK_GALLERIES["default"];

  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState<MediaItem | null>(null);

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

  const openVideo = (item: MediaItem) => {
    setIsPlaying(item);
  };

  const closeVideo = () => {
    setIsPlaying(null);
  };

  return (
    <div className="relative h-[65vh] w-full bg-slate-900 overflow-hidden group">
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
        {images.map((item, index) => (
          <div key={index} className="h-full w-full flex-shrink-0 relative">
            {item.type === "video" ? (
              <div className="relative h-full w-full">
                <video
                  src={item.url}
                  className="h-full w-full object-cover"
                  muted
                  autoPlay
                  loop
                  playsInline
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                  <button
                    onClick={() => openVideo(item)}
                    className="flex h-16 w-16 items-center justify-center rounded-full bg-white/30 backdrop-blur-md transition-transform hover:scale-110 active:scale-95"
                  >
                    <Play className="h-8 w-8 text-white fill-current opacity-90" />
                  </button>
                </div>
              </div>
            ) : (
              <img
                src={item.url}
                className="h-full w-full object-cover"
                alt={`Cast Portrait ${index + 1}`}
                draggable="false"
              />
            )}
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

      {/* Left/Right Tap Areas for Navigation */}
      <div
        className="absolute inset-y-0 left-0 w-1/4 z-10"
        onClick={() => paginate(-1)}
      />
      <div
        className="absolute inset-y-0 right-0 w-1/4 z-10"
        onClick={() => paginate(1)}
      />

      {/* Full Screen Video Overlay */}
      {isPlaying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black animate-in fade-in duration-300">
           <button
            onClick={closeVideo}
            className="absolute top-4 right-4 z-50 rounded-full bg-white/20 p-2 text-white hover:bg-white/40"
          >
            <X size={24} />
          </button>

          <video
            src={isPlaying.url}
            className="h-full w-full object-contain"
            controls
            autoPlay
            playsInline
          />
        </div>
      )}
    </div>
  );
};
