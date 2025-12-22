"use client";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import React, { useEffect, useState } from "react";

interface RitualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const RitualModal: React.FC<RitualModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [isPressing, setIsPressing] = useState(false);
  const progress = useMotionValue(0);
  const circumference = 326;
  const strokeDashoffset = useTransform(progress, [0, 1], [circumference, 0]);

  useEffect(() => {
    let controls: any;

    if (isPressing) {
      controls = animate(progress, 1, {
        duration: 1.5,
        ease: "linear",
        onComplete: () => {
          onComplete(); // Trigger completion
          // Optional: vibrate
          if (typeof navigator !== "undefined" && navigator.vibrate) {
            navigator.vibrate(200);
          }
        },
      });
    } else {
      // Reset if released
      if (progress.get() < 1) {
        controls = animate(progress, 0, { duration: 0.3 });
      }
    }

    return () => controls?.stop();
  }, [isPressing, progress, onComplete]);

  // Reset progress when modal opens
  useEffect(() => {
    if (isOpen) {
      progress.set(0);
      setIsPressing(false);
    }
  }, [isOpen, progress]);


  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-slate-950 border border-yellow-900 w-full max-w-sm rounded-2xl p-6 relative shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-slate-600 hover:text-slate-400"
            >
              ✕
            </button>
            <div className="text-center mb-8 mt-2">
              <h2 className="text-2xl text-white font-serif mb-2 tracking-wide">
                The Promise
              </h2>
              <p className="text-slate-400 text-xs">長押しして誓約</p>
            </div>
            <div className="flex flex-col items-center gap-6">
              <div className="relative w-28 h-28">
                {/* Background Circle */}
                <div className="absolute inset-0 rounded-full border-4 border-slate-800 bg-slate-900"></div>

                {/* Progress Ring */}
                <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none">
                  <motion.circle
                    cx="56"
                    cy="56"
                    r="52"
                    stroke="#eab308"
                    strokeWidth="4"
                    fill="transparent"
                    strokeDasharray={circumference}
                    style={{ strokeDashoffset }}
                    strokeLinecap="round"
                  />
                </svg>

                {/* Interaction Button */}
                <button
                  className="absolute inset-0 w-full h-full rounded-full cursor-pointer z-10 outline-none focus:ring-2 focus:ring-yellow-500/50 focus:ring-offset-2 focus:ring-offset-slate-900"
                  onMouseDown={() => setIsPressing(true)}
                  onMouseUp={() => setIsPressing(false)}
                  onMouseLeave={() => setIsPressing(false)}
                  onTouchStart={() => setIsPressing(true)}
                  onTouchEnd={() => setIsPressing(false)}
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
