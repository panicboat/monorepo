"use client";

import React, { useState, use } from "react";
import Link from "next/link";
import { ChevronLeft, MoreVertical, Send } from "lucide-react";
import { InvitationCard } from "@/components/features/invitation/InvitationCard";
import { RitualModal } from "@/components/features/invitation/RitualModal";
import { SealedBadge } from "@/components/features/invitation/SealedBadge";
import { AnimatePresence, motion } from "framer-motion";

export default function UserChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  // Mock data - in real app would use params.id to fetch
  const { id } = use(params);
  const [isRitualOpen, setIsRitualOpen] = useState(false);
  const [isRitualSealed, setIsRitualSealed] = useState(false);

  const handleOpenRitual = () => {
    setIsRitualOpen(true);
  };

  const handleCompleteRitual = () => {
    setIsRitualSealed(true);
    setIsRitualOpen(false);
  };

  return (
    <div className="bg-slate-950 text-slate-200 h-screen overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center px-4 justify-between z-10">
        <Link href="/chats"><ChevronLeft className="text-slate-400 w-6 h-6 hover:text-white transition" /></Link>
        <div className="flex flex-col items-center">
          <span className="font-bold text-white text-sm">美玲</span>
        </div>
        <button><MoreVertical className="text-slate-400 w-5 h-5" /></button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/50">
        <div className="flex justify-center"><span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded-full">Today</span></div>

        <div className="flex gap-3 flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs text-white">T</div>
          <div className="p-3 text-sm max-w-[80%] bg-blue-900/30 border border-blue-800/30 text-blue-100 rounded-l-2xl rounded-br-2xl">
            久しぶり！今日の21時くらいって空いてるかな？
          </div>
        </div>

        <div className="flex gap-3">
          <Link href={`/casts/${id}`}>
            <div className="w-8 h-8 rounded-full bg-slate-700 bg-cover cursor-pointer hover:opacity-80 transition" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop')" }} />
          </Link>
          <div className="p-3 text-sm max-w-[80%] bg-slate-800 rounded-r-2xl rounded-bl-2xl text-slate-200">
            Takuyaさんお久しぶりです！💕<br />21時大丈夫ですよ✨ 招待状送りますね！
          </div>
        </div>

        {/* Real Invitation Component Integration */}
        <div className="flex gap-3">
          <Link href={`/casts/${id}`}>
            <div className="w-8 h-8 rounded-full bg-slate-700 bg-cover cursor-pointer hover:opacity-80 transition" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop')" }} />
          </Link>
          <div className="max-w-[85%]">
            <AnimatePresence mode="wait">
              {!isRitualSealed ? (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <InvitationCard onClick={handleOpenRitual} />
                </motion.div>
              ) : (
                <motion.div
                  key="badge"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <SealedBadge />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className="bg-slate-950 border-t border-slate-800 p-4 pb-8">
        <div className="flex gap-3 items-end">
          <div className="flex-1 bg-slate-900 rounded-full border border-slate-700 flex items-center px-4 py-2">
            <input type="text" placeholder="メッセージを入力..." className="bg-transparent w-full focus:outline-none text-sm text-white" />
          </div>
          <button className="text-slate-500 hover:text-yellow-500 transition"><Send className="w-5 h-5" /></button>
        </div>
      </footer>

      {/* Ritual Modal for User Acceptance */}
      <RitualModal
        isOpen={isRitualOpen}
        onClose={() => setIsRitualOpen(false)}
        onComplete={handleCompleteRitual}
      />
    </div>
  );
}
