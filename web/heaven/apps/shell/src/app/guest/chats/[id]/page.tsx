"use client";

import React, { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { MessageBubble } from "@/components/features/chat/MessageBubble";
import { ChatInput } from "@/components/features/chat/ChatInput";

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'sticker' | 'invitation';
  timestamp: string;
}

import { RitualModal } from "@/components/features/invitation/RitualModal";
import { SealedBadge } from "@/components/features/invitation/SealedBadge";
import { motion, AnimatePresence } from "framer-motion";

export default function ChatRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Ritual State
  const [isRitualOpen, setIsRitualOpen] = useState(false);
  const [isRitualSealed, setIsRitualSealed] = useState(false);

  useEffect(() => {
    fetch(`/api/chats/${id}/messages`)
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages || []);
      })
      .catch(console.error);
  }, [id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (content: string) => {
    // Optimistic update
    const tempId = Math.random().toString();
    const newMessage: Message = {
      id: tempId,
      senderId: 'me',
      content,
      type: 'text',
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);

    try {
      const res = await fetch(`/api/chats/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type: 'text' })
      });
      if (!res.ok) throw new Error('Failed to send');
    } catch (e) {
      console.error(e);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const handleInteract = (type: string) => {
    if (type === 'invitation') {
      if (!isRitualSealed) {
        setIsRitualOpen(true);
      }
    }
  };

  const handleCompleteRitual = () => {
    setIsRitualSealed(true);
    setIsRitualOpen(false);
  };

  return (
    <div className="bg-slate-950 text-slate-200 h-screen overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="h-14 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center px-4 justify-between z-10">
        <Link href="/guest/chats"><ChevronLeft className="text-slate-400 w-6 h-6 hover:text-white transition" /></Link>
        <div className="flex flex-col items-center">
          <span className="font-bold text-white text-sm">美玲</span>
        </div>
        <button><MoreVertical className="text-slate-400 w-5 h-5" /></button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/50" ref={scrollRef}>
        <div className="flex justify-center"><span className="text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded-full">Today</span></div>

        {messages.map(msg => (
          <div key={msg.id}>
            {msg.type === 'invitation' && isRitualSealed ? (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-700 bg-cover cursor-pointer hover:opacity-80 transition shrink-0"
                  style={{ backgroundImage: "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop')" }} />
                <div className="max-w-[85%]">
                  <SealedBadge />
                </div>
              </div>
            ) : (
              <MessageBubble
                message={msg}
                isMe={msg.senderId === 'me'}
                onInteract={handleInteract}
              />
            )}
          </div>
        ))}
      </main>

      <ChatInput onSend={handleSend} />

      <RitualModal
        isOpen={isRitualOpen}
        onClose={() => setIsRitualOpen(false)}
        onComplete={handleCompleteRitual}
      />
    </div>
  );
}
