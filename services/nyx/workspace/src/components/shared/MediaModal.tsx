"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { fadeVariants, smoothTransition } from "@/lib/motion";
import type { Media } from "@/lib/types";

export type MediaItem = {
  type: "image" | "video" | "gif";
  url: string;
};

type MediaModalProps = {
  isOpen: boolean;
  onClose: () => void;
  media: Media[];
  initialIndex?: number;
};

export const MediaModal = ({
  isOpen,
  onClose,
  media,
  initialIndex = 0,
}: MediaModalProps) => {
  // Reset index when modal opens by using initialIndex directly when not navigated
  const [navigatedIndex, setNavigatedIndex] = useState<number | null>(null);
  const currentIndex = navigatedIndex ?? initialIndex;

  // Reset navigated index when modal closes
  const handleClose = useCallback(() => {
    setNavigatedIndex(null);
    onClose();
  }, [onClose]);

  const goPrev = useCallback(() => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : media.length - 1;
    setNavigatedIndex(newIndex);
  }, [currentIndex, media.length]);

  const goNext = useCallback(() => {
    const newIndex = currentIndex < media.length - 1 ? currentIndex + 1 : 0;
    setNavigatedIndex(newIndex);
  }, [currentIndex, media.length]);

  // Keyboard navigation and body scroll lock
  useEffect(() => {
    if (!isOpen) return;

    // Lock body scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, handleClose, goPrev, goNext]);

  // SSR check - document is not available on server
  if (typeof document === "undefined" || media.length === 0) return null;

  const current = media[currentIndex];

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={fadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={smoothTransition}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={handleClose}
        >
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={handleClose}
            aria-label="Close"
          >
            <X size={24} />
          </button>

          {/* Counter */}
          {media.length > 1 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 text-white/80 text-sm">
              {currentIndex + 1} / {media.length}
            </div>
          )}

          {/* Media Container with Navigation */}
          <div
            className="relative flex items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Navigation - Previous */}
            {media.length > 1 && (
              <button
                onClick={goPrev}
                aria-label="Previous"
                className="flex-shrink-0 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            {/* Media */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                variants={fadeVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={smoothTransition}
                className="max-h-[85vh] max-w-[80vw] overflow-hidden rounded-lg"
              >
                {current.mediaType === "video" ? (
                  <video
                    src={current.url}
                    controls
                    autoPlay
                    playsInline
                    className="max-h-[85vh] max-w-full"
                  />
                ) : (
                  <img
                    src={current.url}
                    alt="Full screen media"
                    className="max-h-[85vh] max-w-full object-contain"
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Navigation - Next */}
            {media.length > 1 && (
              <button
                onClick={goNext}
                aria-label="Next"
                className="flex-shrink-0 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            )}
          </div>

          {/* Dot Indicators */}
          {media.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {media.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNavigatedIndex(i);
                  }}
                  aria-label={`Go to image ${i + 1}`}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentIndex ? "bg-white" : "bg-white/40"
                  }`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
