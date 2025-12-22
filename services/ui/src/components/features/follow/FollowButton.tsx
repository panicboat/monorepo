"use client";

import React, { useState } from "react";
import { Heart, CheckCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function FollowButton() {
  const [isFollowed, setIsFollowed] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleToggle = () => {
    const newState = !isFollowed;
    setIsFollowed(newState);

    // Show toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`w-14 h-14 rounded-2xl flex items-center justify-center transition active:scale-95 border ${isFollowed
            ? "border-red-900 bg-red-900/10"
            : "bg-slate-900 border-slate-800"
          }`}
      >
        <motion.div
          key={isFollowed ? "followed" : "unfollowed"}
          initial={isFollowed ? { scale: 1 } : { scale: 1 }}
          animate={isFollowed ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Heart
            className={`w-6 h-6 transition-colors duration-300 ${isFollowed ? "text-red-500 fill-red-500" : "text-slate-400"
              }`}
          />
        </motion.div>
      </button>

      {/* Toast Notification */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%", scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: -20, x: "-50%", scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="fixed top-20 left-1/2 bg-slate-100 text-slate-900 px-5 py-3 rounded-full shadow-2xl flex items-center gap-3 text-sm font-bold z-[60] min-w-[200px] justify-center"
          >
            <div className="bg-green-500 text-white rounded-full p-0.5">
              <CheckCircle className="w-3 h-3" />
            </div>
            <span>{isFollowed ? "フォローしました" : "フォロー解除しました"}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
