"use client";

import React from "react";
import Link from "next/link";

export function FollowingList() {
  return (
    <div className="space-y-4 pb-24 font-sans">
      <div className="flex justify-between items-center mb-2">
        <p className="text-xs text-slate-500 font-bold tracking-wider">
          NOW AVAILABLE
        </p>
        <span className="text-[10px] text-green-500 bg-green-900/20 px-2 py-0.5 rounded-full border border-green-900/50">
          2 Online
        </span>
      </div>

      {/* Cast 1: Active (Using Link to /cast for demo) */}
      <Link href="/cast" className="block">
        <div className="bg-slate-900 border border-yellow-900/30 rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:bg-slate-800 transition relative overflow-hidden group">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)] group-hover:shadow-[0_0_20px_rgba(34,197,94,0.8)] transition"></div>

          <div
            className="w-14 h-14 rounded-full bg-slate-700 bg-cover border border-slate-700 shrink-0"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100')",
            }}
          ></div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-bold text-white group-hover:text-yellow-500 transition">
                美玲
              </h3>
              <span className="text-[10px] bg-green-900/40 text-green-400 px-2 py-0.5 rounded border border-green-800/50 shrink-0">
                Tonight
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1 group-hover:text-slate-300">
              21時から1枠空きました！誰か飲みませんか？🍷
            </p>
          </div>
        </div>
      </Link>

      {/* Cast 2: Online */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex items-center gap-4 cursor-pointer hover:bg-slate-800 transition relative overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500/50"></div>
        <div
          className="w-14 h-14 rounded-full bg-slate-700 bg-cover border border-slate-700 shrink-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100')",
          }}
        ></div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-white">Jessica</h3>
            <span className="text-[10px] bg-slate-800 text-green-500 px-2 py-0.5 rounded border border-slate-700 shrink-0">
              Online
            </span>
          </div>
          <p className="text-xs text-slate-400 line-clamp-1">
            チャット返せます〜
          </p>
        </div>
      </div>

      <div className="h-px bg-slate-800 my-4"></div>
      <p className="text-xs text-slate-500 mb-2 font-bold tracking-wider">
        OTHERS
      </p>

      {/* Cast 3: Offline */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 flex items-center gap-4 opacity-60 hover:opacity-100 transition cursor-pointer">
        <div
          className="w-14 h-14 rounded-full bg-slate-700 bg-cover grayscale shrink-0"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100')",
          }}
        ></div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <h3 className="font-bold text-slate-300">Yuna</h3>
            <span className="text-[10px] text-slate-600 bg-slate-900 px-2 py-0.5 rounded shrink-0">
              Offline
            </span>
          </div>
          <p className="text-xs text-slate-500">また来週！</p>
        </div>
      </div>
    </div>
  );
}
