"use client";

import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { fadeVariants, scaleFadeVariants, smoothTransition } from "@/lib/motion";

export type MediaItem = {
  type: "image" | "video" | "gif";
  url: string;
};

export const MediaModal = ({
  isOpen,
  onClose,
  media,
}: {
  isOpen: boolean;
  onClose: () => void;
  media: MediaItem | null;
}) => {
  if (!media) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={fadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={smoothTransition}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={onClose}
        >
          {/* Close Button */}
          <button
            className="absolute top-4 right-4 z-50 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X size={24} />
          </button>

          <motion.div
            variants={scaleFadeVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={smoothTransition}
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {media.type === "video" ? (
              <video
                src={media.url}
                controls
                autoPlay
                playsInline
                className="max-h-[85vh] max-w-full"
              />
            ) : (
              <img
                src={media.url}
                alt="Full screen media"
                className="max-h-[85vh] max-w-full object-contain"
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
