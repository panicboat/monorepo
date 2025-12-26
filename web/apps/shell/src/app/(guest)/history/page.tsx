"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  PenTool,
  Star,
  Send,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export default function UserHistoryPage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "history">("history");
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  // Slider states
  const [looksRating, setLooksRating] = useState(4);
  const [charmRating, setCharmRating] = useState(5);
  const [techRating, setTechRating] = useState(3);

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <header className="px-5 pt-6 pb-2 bg-slate-950 sticky top-0 z-10">
        <h1
          className="text-xl font-bold text-white tracking-wide mb-4 font-serif-jp"
        >
          My Archive
        </h1>
        <div className="flex gap-6 border-b border-slate-800 text-sm font-bold">
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`pb-3 transition ${activeTab === "upcoming"
              ? "text-white border-b-2 border-yellow-500"
              : "text-slate-500 hover:text-white"
              }`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`pb-3 transition ${activeTab === "history"
              ? "text-white border-b-2 border-yellow-500"
              : "text-slate-500 hover:text-white"
              }`}
          >
            History
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4 pb-24">
        {activeTab === "history" && (
          <>
            {/* Unreviewed Item */}
            <div className="bg-slate-900 border border-yellow-900/30 rounded-xl p-4 relative overflow-hidden group">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full bg-slate-800 bg-cover"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100')",
                    }}
                  ></div>
                  <div>
                    <h3 className="font-bold text-white text-sm">美玲</h3>
                    <p className="text-[10px] text-slate-400">Club VENUS</p>
                  </div>
                </div>
                <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-1 rounded border border-slate-700">
                  2023.12.20
                </span>
              </div>

              <div className="flex justify-between items-end">
                <div className="text-xs text-slate-500">
                  <p>90min Course</p>
                  <p>¥35,000 (現地決済済)</p>
                </div>
                <button
                  onClick={() => setIsReviewOpen(true)}
                  className="bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-lg shadow-yellow-900/20 flex items-center gap-2 transition active:scale-95"
                >
                  <PenTool className="w-3 h-3" />
                  レビューを書く
                </button>
              </div>
            </div>

            {/* Reviewed Item */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 opacity-75">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full bg-slate-800 bg-cover grayscale"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100')",
                    }}
                  ></div>
                  <div>
                    <h3 className="font-bold text-slate-400 text-sm">
                      Jessica
                    </h3>
                    <p className="text-[10px] text-slate-600">Club VENUS</p>
                  </div>
                </div>
                <span className="text-slate-600 text-[10px]">2023.11.15</span>
              </div>
              <div className="flex justify-between items-end">
                <div className="text-xs text-slate-600">
                  <p>60min Course</p>
                  <p>¥20,000</p>
                </div>
                <div className="flex items-center gap-1 text-yellow-600/50 text-xs">
                  <Star className="w-3 h-3 fill-current" />
                  <span>Rated 5.0</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === "upcoming" && (
          <div className="text-center py-20">
            <p className="text-slate-500 text-sm">No upcoming appointments</p>
          </div>
        )}
      </main>

      {/* Review Modal */}
      <AnimatePresence>
        {isReviewOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReviewOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900 border-t border-slate-800 rounded-t-3xl z-50 p-6"
            >
              <div className="w-12 h-1 bg-slate-700 rounded-full mx-auto mb-6"></div>

              <div className="text-center mb-8 relative">
                <button
                  onClick={() => setIsReviewOpen(false)}
                  className="absolute -top-2 right-0 p-2 text-slate-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
                <h2
                  className="text-lg font-bold text-white mb-1 font-serif-jp"
                >
                  美玲 へのレビュー
                </h2>
                <p className="text-xs text-slate-500">
                  あなたの評価がキャストの資産になります
                </p>
              </div>

              <div className="space-y-5 mb-8">
                <RatingSlider
                  label="Looks"
                  value={looksRating}
                  onChange={setLooksRating}
                />
                <RatingSlider
                  label="Charm"
                  value={charmRating}
                  onChange={setCharmRating}
                />
                <RatingSlider
                  label="Tech"
                  value={techRating}
                  onChange={setTechRating}
                />
              </div>

              <textarea
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-yellow-600 transition mb-6 resize-none"
                placeholder="その他の感想や、良かった点があれば教えてください..."
              ></textarea>

              <button
                onClick={() => setIsReviewOpen(false)}
                className="w-full bg-gradient-to-r from-yellow-700 to-yellow-600 text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <span>レビューを投稿する</span>
                <Send className="w-4 h-4" />
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function RatingSlider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-xs text-slate-400 w-12 font-bold">{label}</span>
      <input
        type="range"
        min="1"
        max="5"
        step="1"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="flex-1 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-yellow-500 [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(234,179,8,0.5)]"
      />
      <span className="text-sm font-mono text-yellow-500 w-6 text-right font-bold">
        {value}
      </span>
    </div>
  );
}
