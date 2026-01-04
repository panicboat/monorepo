"use client";

import React from "react";
import { Gem } from "lucide-react";
import { motion } from "framer-motion";
import clsx from "clsx";

export function RadarChart({ className }: { className?: string }) {
  return (
    <div className={clsx("flex gap-6 items-center", className)}>
      <div className="relative w-28 h-28 flex-shrink-0">
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full transform -rotate-90"
        >
          <polygon
            points="50,5 95,35 78,90 22,90 5,35"
            fill="none"
            stroke="#334155"
            strokeWidth="1"
          />
          <polygon
            points="50,25 75,40 65,70 35,70 25,40"
            fill="none"
            stroke="#1e293b"
            strokeWidth="1"
          />
          <motion.polygon
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.8 }}
            transition={{
              duration: 1,
              ease: [0.34, 1.56, 0.64, 1],
              delay: 0.3,
            }}
            points="50,5 95,35 78,90 35,70 5,35"
            fill="rgba(234, 179, 8, 0.4)"
            stroke="#eab308"
            strokeWidth="2"
            className="origin-center"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Gem className="w-4 h-4 text-yellow-500/50" />
        </div>
      </div>

      <div className="flex-1">
        <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">
          Verified Traits
        </h3>
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 rounded-md bg-yellow-900/20 border border-yellow-800/50 text-yellow-200 text-xs font-medium">
            #写真より可愛い <span className="text-yellow-600 ml-0.5">12</span>
          </span>
          <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs">
            #神対応 <span className="text-slate-500 ml-0.5">8</span>
          </span>
          <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs">
            #Sっ気 <span className="text-slate-500 ml-0.5">5</span>
          </span>
          <span className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-xs">
            #英語OK
          </span>
        </div>
      </div>
    </div>
  );
}
