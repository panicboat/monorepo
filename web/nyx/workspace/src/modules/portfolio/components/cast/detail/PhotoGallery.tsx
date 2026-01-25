"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { MediaItem } from "@/modules/portfolio/types";
import { Play, X, ImageOff } from "lucide-react";

export const PhotoGallery = ({
  castId,
  images,
}: {
  castId: string;
  images?: MediaItem[];
}) => {
  const [current, setCurrent] = useState(0);
  const [isPlaying, setIsPlaying] = useState<MediaItem | null>(null);

  // If no images, show placeholder
  if (!images || images.length === 0) {
    return (
      <div className="relative h-[65vh] w-full bg-slate-200 overflow-hidden flex items-center justify-center">
        <div className="text-center text-slate-400">
          <ImageOff className="w-16 h-16 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No photos available</p>
        </div>
      </div>
    );
  }

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
