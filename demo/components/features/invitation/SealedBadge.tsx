"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React from "react";

export const SealedBadge: React.FC = () => {
  return (
    <motion.div
      initial={{ scale: 1.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", damping: 12, stiffness: 200 }}
      className="bg-gradient-to-br from-red-900 to-red-950 text-red-100 px-5 py-4 rounded-lg shadow-lg border border-red-800 flex items-center gap-4 relative overflow-hidden select-none"
    >
      <div className="w-10 h-10 bg-yellow-600 rounded-full flex items-center justify-center text-red-900 font-bold">
        ✓
      </div>
      <div>
        <h3 className="text-lg font-serif font-bold text-yellow-500 tracking-wider">
          PROMISED
        </h3>
        <p className="text-xs text-red-300 opacity-80">約束は確定されました</p>
      </div>
    </motion.div>
  );
};
