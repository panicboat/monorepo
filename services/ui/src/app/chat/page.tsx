"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronLeft, MoreVertical, Ticket, Send, CheckCircle } from "lucide-react";
import { InvitationDrawer } from "@/components/chat/InvitationDrawer";
import { InvitationCard } from "@/components/features/invitation/InvitationCard";
import { RitualModal } from "@/components/features/invitation/RitualModal";
import { SealedBadge } from "@/components/features/invitation/SealedBadge";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatPage() {
  const [mode, setMode] = useState<'chat' | 'builder' | 'invitation' | 'report'>('chat');
  const [messages, setMessages] = useState<Array<{ type: 'text' | 'invitation', text?: string, sender: 'user' | 'cast' }>>([
    { type: 'text', sender: 'user', text: "久しぶり！今日の21時くらいって空いてるかな？\n90分コースでお願いしたい！" },
    { type: 'text', sender: 'cast', text: "Takuyaさんお久しぶりです！💕\n21時大丈夫ですよ✨ 招待状送りますね！" }
  ]);
  const [showToast, setShowToast] = useState(false);
  const [isRitualSealed, setIsRitualSealed] = useState(false);

  // Function to add invitation message
  const handleSendInvitation = () => {
    setMode('chat');
    setMessages([...messages, { type: 'invitation', sender: 'cast' }]);

    // Show toast
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2000);
  };

  const handleOpenRitual = () => {
    if (!isRitualSealed) {
      setMode('invitation');
    }
  };

  const handleCompleteRitual = () => {
    setIsRitualSealed(true);
    setMode('chat');
  };

  return (
    <div className="bg-slate-950 text-slate-200 h-screen overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md flex items-center px-4 justify-between z-10">
        <div className="flex items-center gap-3">
          <Link href="/"><ChevronLeft className="text-slate-400 w-6 h-6 hover:text-white transition" /></Link>
          <div className="flex flex-col">
            <span className="font-bold text-white text-sm">Takuya (User)</span>
            <span className="text-[10px] text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Online
            </span>
          </div>
        </div>
        <button><MoreVertical className="text-slate-400 w-5 h-5" /></button>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/50">
        <div className="flex justify-center"><span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded-full">Today</span></div>

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.sender === 'cast' ? 'flex-row-reverse' : ''}`}>
            {msg.sender === 'user' ? (
              <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs text-white">T</div>
            ) : (
              <Link href="/cast">
                <div
                  className="w-8 h-8 rounded-full bg-slate-700 bg-cover cursor-pointer hover:opacity-80 transition"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop')" }}
                />
              </Link>
            )}

            {msg.type === 'text' ? (
              <div
                className={`p-3 text-sm max-w-[80%] whitespace-pre-wrap ${msg.sender === 'cast'
                  ? 'bg-yellow-900/30 border border-yellow-800/30 text-yellow-100 rounded-l-2xl rounded-br-2xl'
                  : 'bg-slate-800 rounded-r-2xl rounded-bl-2xl text-slate-200'
                  }`}
              >
                {msg.text}
              </div>
            ) : (
              <div className="max-w-[85%]">
                {/* Invitation Card */}
                {!isRitualSealed ? (
                  <InvitationCard onClick={handleOpenRitual} />
                ) : (
                  <SealedBadge />
                )}
              </div>
            )}
          </div>
        ))}

        <div className="h-24"></div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 p-4 pb-8 relative z-20">
        <div className="flex gap-3 items-end">
          <button
            onClick={() => setMode(mode === 'builder' ? 'chat' : 'builder')}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-lg shadow-yellow-900/40 transform hover:scale-105 transition"
          >
            <Ticket className="text-black w-5 h-5 fill-black/20" />
          </button>

          <div className="flex-1 bg-slate-900 rounded-full border border-slate-700 flex items-center px-4 py-2">
            <input type="text" placeholder="メッセージを入力..." className="bg-transparent w-full focus:outline-none text-sm text-white" />
          </div>
          <button className="text-slate-500 hover:text-yellow-500 transition"><Send className="w-5 h-5" /></button>
        </div>
      </footer>

      {/* Overlays */}
      <InvitationDrawer
        isOpen={mode === 'builder'}
        onClose={() => setMode('chat')}
        onSend={handleSendInvitation}
      />

      <RitualModal
        isOpen={mode === 'invitation'}
        onClose={() => setMode('chat')}
        onComplete={handleCompleteRitual}
      />

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className="fixed top-20 left-1/2 bg-slate-800 border border-yellow-600/30 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-2 z-50"
          >
            <CheckCircle className="text-yellow-500 w-4 h-4" />
            <span className="text-sm">招待状を送信しました</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
