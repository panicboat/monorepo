"use client";

import React from "react";
import {
  ChevronLeft,
  Share,
  Play,
  BadgeCheck,
  MapPin,
  Gem,
  Heart,
  Send
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { FollowButton } from "@/components/features/follow/FollowButton";
import { use } from "react";

export default function CastProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen font-sans antialiased pb-24">
      <div className="max-w-md mx-auto relative bg-slate-950 min-h-screen shadow-2xl overflow-hidden">

        {/* Hero Section */}
        <div className="relative h-[65vh] w-full bg-slate-800 overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=988&auto=format&fit=crop"
            alt="Cast Image"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />

          {/* Gradient Overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, #020617 0%, #020617 15%, transparent 50%, rgba(0, 0, 0, 0.3) 100%)'
            }}
          />

          {/* Header Buttons */}
          <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
            <Link href="/home" className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 text-white hover:bg-black/40 transition">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <button className="w-10 h-10 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center border border-white/10 text-white">
              <Share className="w-5 h-5" />
            </button>
          </div>

          {/* Voice Preview */}
          <div className="absolute bottom-48 right-4 z-20">
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-3 py-2 rounded-full cursor-pointer hover:bg-white/20 transition">
              <div className="bg-yellow-500 rounded-full p-1">
                <Play className="w-3 h-3 text-black fill-current" />
              </div>
              <span className="text-xs text-white font-medium">Voice</span>
              <div className="flex gap-0.5 items-end h-3">
                <motion.div
                  animate={{ height: ["4px", "12px", "4px"] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
                  className="w-0.5 bg-white"
                />
                <motion.div
                  animate={{ height: ["4px", "12px", "4px"] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  className="w-0.5 bg-white"
                />
                <motion.div
                  animate={{ height: ["4px", "8px", "4px"] }}
                  transition={{ duration: 1, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                  className="w-0.5 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Cast Info */}
          <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
            <div className="flex items-end justify-between mb-2">
              <div className="relative">
                <div className="absolute -top-1 -right-4 flex items-center justify-center">
                  <motion.span
                    animate={{ scale: [0.8, 2.4], opacity: [0.8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inline-flex h-3 w-3 rounded-full bg-green-400 opacity-75"
                  />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 border border-black"></span>
                </div>

                <h1 className="text-4xl font-bold text-white tracking-wide flex items-center gap-2 font-[family-name:var(--font-geist-mono)]">
                  美玲
                  <BadgeCheck className="w-6 h-6 text-yellow-500 fill-yellow-500/20" />
                </h1>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Promise Rate</p>
                <div className="text-2xl font-bold text-yellow-400 font-mono">100<span className="text-sm text-yellow-600">%</span></div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-300 mb-4">
              <span className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900/50 text-xs">24歳</span>
              <span className="px-2 py-0.5 rounded border border-slate-700 bg-slate-900/50 text-xs">T162</span>
              <span className="text-slate-500">|</span>
              <span className="flex items-center gap-1 text-slate-200">
                <MapPin className="w-3 h-3 text-yellow-600" />
                Club VENUS (歌舞伎町)
              </span>
            </div>

            <div className="bg-gradient-to-r from-green-900/40 to-slate-900/40 border border-green-800/30 rounded-lg p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-xs font-bold text-green-400">On Air (返信早め)</span>
              </div>
              <p className="text-xs text-slate-200">
                本日は20時から空きあります✨ 久しぶりの出勤なのでお話したいです！
              </p>
            </div>
          </div>
        </div>

        {/* Radar Chart Section */}
        <div className="px-6 py-8 bg-slate-950 relative">
          <div className="flex gap-6 items-center">
            <div className="relative w-28 h-28 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                <polygon points="50,5 95,35 78,90 22,90 5,35" fill="none" stroke="#334155" strokeWidth="1" />
                <polygon points="50,25 75,40 65,70 35,70 25,40" fill="none" stroke="#1e293b" strokeWidth="1" />
                <motion.polygon
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 0.8 }}
                  transition={{ duration: 1, ease: [0.34, 1.56, 0.64, 1], delay: 0.3 }}
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
          </div>

          <div className="flex-1">
            <h3 className="text-xs text-slate-500 uppercase tracking-wider mb-3">Verified Traits</h3>
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

        <div className="flex justify-between text-[10px] text-slate-500 mt-2 px-2">
          <span>Look</span>
          <span>Promise</span>
          <span>Tech</span>
        </div>

        {/* Portfolio Section */}
        <div className="bg-slate-900 rounded-t-3xl min-h-[500px] p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg text-white font-[family-name:var(--font-geist-mono)]">Portfolio</h3>
            <span className="text-xs text-slate-500">32 Photos</span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="relative group rounded-xl overflow-hidden mb-2">
              <div className="absolute top-2 left-2 bg-yellow-500 text-black text-[10px] font-bold px-1.5 py-0.5 rounded">PIN</div>
              <img src="https://images.unsplash.com/photo-1616091093747-47804425986c?q=80&w=600&auto=format&fit=crop" className="w-full h-64 object-cover" />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition"></div>
            </div>
            <div className="relative group rounded-xl overflow-hidden mb-2">
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop" className="w-full h-40 object-cover" />
            </div>
            <div className="relative group rounded-xl overflow-hidden mb-2">
              <img src="https://images.unsplash.com/photo-1524504388940-b1c1722653e1?q=80&w=600&auto=format&fit=crop" className="w-full h-40 object-cover" />
            </div>
            <div className="relative group rounded-xl overflow-hidden mb-2">
              <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop" className="w-full h-56 object-cover" />
            </div>
          </div>

          <div className="mt-8">
            <h3 className="text-lg text-white mb-4 font-[family-name:var(--font-geist-mono)]">Latest Review</h3>
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-500">★★★★★</span>
                  <span className="text-xs text-green-500 bg-green-900/30 border border-green-800 px-1.5 rounded">来店確認済</span>
                </div>
                <span className="text-xs text-slate-500">2日前</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                写真通りの美女でした。何より、待ち合わせ場所に5分前に来てくれていて、予約のやり取りも丁寧で安心できました。リピート確定です。
              </p>
            </div>
          </div>
        </div>

        {/* Floating Footer */}
        <div className="fixed bottom-0 left-0 right-0 p-4 pt-8 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent z-50 max-w-md mx-auto">
          <div className="flex justify-center mb-2">
            <div className="bg-yellow-900/30 text-yellow-200 text-[10px] px-3 py-1 rounded-full border border-yellow-700/30 animate-bounce">
              現在、チャット即レス可能です ✨
            </div>
          </div>

          <div className="flex gap-3 h-14">
            <FollowButton />

            <Link href="/chats/mirei" className="flex-1 bg-gradient-to-r from-yellow-700 to-yellow-600 rounded-2xl flex items-center justify-between px-6 text-white shadow-lg shadow-yellow-900/20 hover:from-yellow-600 hover:to-yellow-500 transition active:scale-95 group">
              <span className="flex flex-col items-start">
                <span className="text-xs text-yellow-200/80 font-medium">まずは相談から</span>
                <span className="text-lg font-bold font-[family-name:var(--font-geist-mono)]">招待状をリクエスト</span>
              </span>
              <div className="bg-white/20 p-2 rounded-full group-hover:bg-white/30 transition">
                <Send className="w-5 h-5" />
              </div>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
