"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Bell, Search, MessageSquare } from "lucide-react";
import { FollowingList } from "@/components/features/home/FollowingList";

type Tab = "discover" | "following";

export default function UserHomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("following");

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 bg-slate-950/90 backdrop-blur z-20 border-b border-slate-800">
        <div className="flex items-center justify-between px-4 h-14">
          <span className="font-bold text-lg text-yellow-500 font-serif-jp">
            PrivateHeaven
          </span>
          <div className="flex items-center gap-4">
            <Link href="/chats">
              <MessageSquare className="text-slate-400 w-5 h-5 cursor-pointer hover:text-white transition" />
            </Link>
            <Bell className="text-slate-400 w-5 h-5 cursor-pointer hover:text-white transition" />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-2">
          <button
            onClick={() => setActiveTab("discover")}
            className={`flex-1 py-3 text-sm border-b-2 relative transition ${activeTab === "discover"
              ? "text-white font-bold border-yellow-500"
              : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
          >
            Discover
          </button>
          <button
            onClick={() => setActiveTab("following")}
            className={`flex-1 py-3 text-sm border-b-2 relative transition ${activeTab === "following"
              ? "text-white font-bold border-yellow-500"
              : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
          >
            Following
            <span className="absolute top-2 right-8 w-2 h-2 bg-red-500 rounded-full border border-slate-950"></span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar p-4">
        {activeTab === "following" ? (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <FollowingList />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 content-discover p-4 text-center mt-20">
            <div className="w-16 h-16 bg-slate-800 rounded-full mx-auto mb-4 flex items-center justify-center text-slate-600">
              <Search className="w-8 h-8" />
            </div>
            <p className="text-slate-500 text-sm">Discover List Here</p>
          </div>
        )}
      </div>
    </div>
  );
}
