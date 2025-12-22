"use client";

import React from "react";
import Link from "next/link";
import {
  Settings,
  Camera,
  BadgeCheck,
  ExternalLink,
  ImagePlus,
  Users,
  Ticket,
  ShieldAlert,
  LogOut,
  MessageCircle,
} from "lucide-react";

export default function CastMyPage() {
  return (
    <div className="bg-slate-950 text-slate-200 h-screen font-sans flex justify-center">
      <div className="w-full max-w-md bg-slate-950 h-full relative shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 pb-8 bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-lg font-bold text-slate-400">Backstage</h1>
            <button className="text-slate-400 hover:text-white transition">
              <Settings className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-5">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-full bg-slate-800 bg-cover border-2 border-slate-700"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200')",
                }}
              ></div>
              <button className="absolute bottom-0 right-0 bg-slate-800 p-1.5 rounded-full border border-slate-600 text-white hover:bg-slate-700 transition">
                <Camera className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h2
                  className="text-2xl font-bold text-white"
                  style={{ fontFamily: '"Yu Mincho", serif' }}
                >
                  美玲
                </h2>
                <BadgeCheck className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />
              </div>
              <Link
                href="/casts/mirei"
                className="text-xs text-yellow-600 flex items-center gap-1 hover:text-yellow-500 transition"
              >
                <span>プロフィールをプレビュー</span>
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 -mt-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex justify-around">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase mb-1">
                Total Sales
              </p>
              <p className="text-xl font-bold text-white font-mono">
                ¥420<span className="text-sm text-slate-500">k</span>
              </p>
            </div>
            <div className="w-px bg-slate-800 h-10 self-center"></div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase mb-1">
                Followers
              </p>
              <p className="text-xl font-bold text-white font-mono">24</p>
            </div>
            <div className="w-px bg-slate-800 h-10 self-center"></div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase mb-1">
                Promise Rate
              </p>
              <p className="text-xl font-bold text-green-500 font-mono">
                100<span className="text-sm">%</span>
              </p>
            </div>
          </div>
        </div>

        {/* Main Menu */}
        <main className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3 mt-4">
          <p className="text-xs text-slate-500 font-bold uppercase ml-2 mb-1">
            Manage
          </p>

          <button className="w-full bg-slate-900/50 hover:bg-slate-800 border border-slate-800/50 rounded-xl p-4 flex items-center justify-between group transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pink-900/20 flex items-center justify-center text-pink-400">
                <ImagePlus className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">
                  プロフィール編集
                </p>
                <p className="text-xs text-slate-500">
                  写真・動画・タグの管理
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition" />
          </button>

          <button className="w-full bg-slate-900/50 hover:bg-slate-800 border border-slate-800/50 rounded-xl p-4 flex items-center justify-between group transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-yellow-900/20 flex items-center justify-center text-yellow-500">
                <Users className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">フォロワーリスト</p>
                <p className="text-xs text-slate-500">顧客メモの管理・営業</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition" />
          </button>

          <button className="w-full bg-slate-900/50 hover:bg-slate-800 border border-slate-800/50 rounded-xl p-4 flex items-center justify-between group transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-900/20 flex items-center justify-center text-indigo-400">
                <Ticket className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">
                  招待状プラン設定
                </p>
                <p className="text-xs text-slate-500">
                  コース内容・料金の編集
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition" />
          </button>

          <p className="text-xs text-slate-500 font-bold uppercase ml-2 mb-1 mt-4">
            Account
          </p>

          <button className="w-full bg-slate-900/50 hover:bg-slate-800 border border-slate-800/50 rounded-xl p-4 flex items-center justify-between group transition">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold text-white">ブロックリスト</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-white transition" />
          </button>

          <button className="w-full p-4 flex items-center gap-3 text-red-500/70 hover:text-red-500 transition justify-center mt-4">
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-bold">ログアウト</span>
          </button>
        </main>

        {/* Navigation */}
        <nav className="bg-slate-950 border-t border-slate-800 h-16 flex items-center justify-around z-20">
          <Link
            href="/cast/home"
            className="flex flex-col items-center gap-1 w-16 text-slate-500 hover:text-white transition"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="text-[9px]">Chats</span>
          </Link>
          <button className="flex flex-col items-center gap-1 w-16 text-slate-500 hover:text-white transition">
            <Users className="w-6 h-6" />
            <span className="text-[9px]">Followers</span>
          </button>
          <button className="flex flex-col items-center gap-1 w-16 text-yellow-500">
            <div className="w-6 h-6 rounded-full bg-slate-700 overflow-hidden border border-yellow-500">
              <div
                className="w-full h-full bg-cover"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100')",
                }}
              ></div>
            </div>
            <span className="text-[9px] font-bold">My Page</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
