"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FeedMediaItem } from "./types";
import { fadeVariants, fastTransition } from "@/lib/motion";

interface MediaCarouselProps {
  media: FeedMediaItem[];
  onClick?: (e: React.MouseEvent) => void;
}

export function MediaCarousel({ media, onClick }: MediaCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const goTo = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i > 0 ? i - 1 : media.length - 1));
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((i) => (i < media.length - 1 ? i + 1 : 0));
  };

  const current = media[currentIndex];

  return (
    <div className="mb-3 overflow-hidden rounded-xl bg-black/5 relative" onClick={onClick}>
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          variants={fadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={fastTransition}
        >
          {current.mediaType === "video" ? (
            <>
              <video
                src={current.url}
                className="h-full w-full object-cover max-h-[400px]"
                autoPlay
                muted
                loop
                playsInline
              />
              <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider backdrop-blur-sm">
                GIF Preview
              </div>
            </>
          ) : (
            <img
              src={current.url}
              alt="Post"
              className="h-full w-full object-cover max-h-[400px]"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {media.length > 1 && (
        <>
          <button
            onClick={goPrev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-surface/80 hover:bg-surface rounded-full p-1 shadow-sm transition-colors"
          >
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <button
            onClick={goNext}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-surface/80 hover:bg-surface rounded-full p-1 shadow-sm transition-colors"
          >
            <ChevronRight aria-hidden="true" size={16} />
          </button>
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1" role="tablist" aria-label="Image navigation">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={(e) => goTo(e, i)}
                role="tab"
                aria-selected={i === currentIndex}
                aria-label={`Go to image ${i + 1}`}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentIndex ? "bg-surface" : "bg-surface/50"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
