"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserCog, Lock } from "lucide-react";

interface CRMDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CRMDrawer({ isOpen, onClose }: CRMDrawerProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="absolute top-0 right-0 h-full w-[85%] bg-slate-900 border-l border-slate-700 z-50 shadow-2xl flex flex-col font-sans"
          >
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="text-sm font-bold text-yellow-500 flex items-center gap-2">
                <UserCog className="w-4 h-4" /> 顧客カルテ
              </h3>
              <button onClick={onClose}>
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-blue-900 flex items-center justify-center text-lg font-bold text-white">
                  T
                </div>
                <div>
                  <div className="text-white font-bold">Takuya</div>
                  <div className="text-xs text-slate-400">来店回数: 3回</div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Private Memo
                </label>
                <textarea
                  className="w-full h-40 bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-3 text-sm text-yellow-100 focus:outline-none focus:border-yellow-600 transition resize-none placeholder-yellow-900/50"
                  placeholder="メモ..."
                  defaultValue={`赤ワインが好き（フルボディ）。\n仕事はIT系。\nタバコは吸わない。\n前回は90分コースで延長あり。`}
                />
                <p className="text-[10px] text-slate-500 text-right">
                  自動保存されました
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
