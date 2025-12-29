"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Users, Calendar } from "lucide-react";

export const CastBottomNav = () => {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="bg-slate-950 border-t border-slate-800 h-16 flex items-center justify-around z-20 pb-safe w-full absolute bottom-0">
      <Link
        href="/cast/dashboard"
        className={`flex flex-col items-center gap-1 w-16 transition ${isActive("/cast/dashboard") ? "text-yellow-500" : "text-slate-500 hover:text-white"
          }`}
      >
        <div className="relative">
          <MessageCircle className={`w-6 h-6 ${isActive("/cast/dashboard") ? "fill-yellow-500/20" : ""}`} />
          {/* Unread badge mock */}
          {!isActive("/cast/dashboard") && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-950"></div>}
        </div>
        <span className={`text-[9px] ${isActive("/cast/dashboard") ? "font-bold" : ""}`}>Chats</span>
      </Link>

      <button className="flex flex-col items-center gap-1 w-16 text-slate-500 hover:text-white transition">
        <Users className="w-6 h-6" />
        <span className="text-[9px]">Followers</span>
      </button>

      <Link
        href="/cast/schedule"
        className={`flex flex-col items-center gap-1 w-16 transition ${isActive("/cast/schedule") ? "text-yellow-500" : "text-slate-500 hover:text-white"
          }`}
      >
        <Calendar className={`w-6 h-6 ${isActive("/cast/schedule") ? "fill-yellow-500/20" : ""}`} />
        <span className={`text-[9px] ${isActive("/cast/schedule") ? "font-bold" : ""}`}>Schedule</span>
      </Link>

      <Link
        href="/cast/mypage"
        className={`flex flex-col items-center gap-1 w-16 transition ${isActive("/cast/mypage") ? "text-white" : "text-slate-500 hover:text-white"
          }`}
      >
        <div className={`w-6 h-6 rounded-full overflow-hidden border ${isActive("/cast/mypage") ? "border-yellow-500" : "border-slate-600"}`}>
          <div
            className="w-full h-full bg-cover"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100')",
            }}
          ></div>
        </div>
        <span className={`text-[9px] ${isActive("/cast/mypage") ? "font-bold" : ""}`}>My Page</span>
      </Link>
    </nav>
  );
};
