"use client";

import React from "react";
import Link from "next/link";
import { Send, Heart } from "lucide-react";

export function FloatingFooter({ castId }: { castId: string }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 pt-8 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-50 max-w-md mx-auto">
      <div className="flex justify-center mb-2">
        <div className="bg-yellow-900/30 text-yellow-200 text-[10px] px-3 py-1 rounded-full border border-yellow-700/30 animate-bounce">
          現在、チャット即レス可能です ✨
        </div>
      </div>

      <div className="flex gap-3 h-14">
        {/* Fake Follow Button */}
        <button className="h-full px-5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:bg-white/10 hover:text-white transition group relative overflow-hidden">
          <Heart className="w-6 h-6 group-active:scale-90 transition" />
        </button>

        <Link
          href={`/chats/${castId}`}
          className="flex-1 bg-gradient-to-r from-yellow-700 to-yellow-600 rounded-2xl flex items-center justify-between px-6 text-white shadow-lg shadow-yellow-900/20 hover:from-yellow-600 hover:to-yellow-500 transition active:scale-95 group"
        >
          <span className="flex flex-col items-start">
            <span className="text-xs text-yellow-200/80 font-medium">
              まずは相談から
            </span>
            <span className="text-lg font-bold font-serif-jp">
              招待状をリクエスト
            </span>
          </span>
          <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition">
            <Send className="w-5 h-5" />
          </div>
        </Link>
      </div>
    </div>
  );
}
