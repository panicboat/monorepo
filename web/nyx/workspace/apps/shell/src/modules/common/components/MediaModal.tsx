"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

export type MediaItem = {
  type: "image" | "video" | "gif";
  url: string;
};

export const MediaModal = ({
  isOpen,
  onClose,
  media
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
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
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
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
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
