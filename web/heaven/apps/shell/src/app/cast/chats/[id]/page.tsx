"use client";

import React, { useState, useEffect, use, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, MoreVertical, Ticket, Send } from "lucide-react";
import { MessageBubble } from "@/components/features/chat/MessageBubble";
import SmartInvitationDrawer from "@/components/features/chat/SmartInvitationDrawer";

interface Message {
  id: string;
  senderId: string;
  content: string;
  type: 'text' | 'image' | 'sticker' | 'invitation';
  timestamp: string;
}

export default function CastChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [inputText, setInputText] = useState("");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    // Reusing the same mock endpoint.
    // In a real app, this might be /api/cast/chats/:id/messages
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

  const handleSendText = async () => {
    if (!inputText.trim()) return;
    const content = inputText;
    setInputText("");

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
      await fetch(`/api/chats/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type: 'text' })
      });
    } catch (e) {
      console.error(e);
    }
  };

  interface InvitationData {
    plan: string;
    slot: string;
    message: string;
  }

  const handleSendInvitation = async (data: InvitationData) => {
    // Optimistic update for invitation
    // In reality, we might render a special Invitation Bubble
    const tempId = Math.random().toString();
    const newMessage: Message = {
      id: tempId,
      senderId: 'me',
      content: `招待状を送りました: ${data.plan} (${data.message})`,
      type: 'invitation', // We'll need to handle this type in Bubble or just show text for now
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, newMessage]);

    try {
      await fetch(`/api/chats/${id}/invitations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="bg-slate-950 text-slate-200 h-screen overflow-hidden flex flex-col font-sans">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md flex items-center px-4 justify-between z-10">
        <Link href="/cast/dashboard"><ChevronLeft className="text-slate-400 w-6 h-6" /></Link>
        <span className="font-bold text-white">Takuya</span>
        <button><MoreVertical className="text-slate-400 w-5 h-5" /></button>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-900/50" ref={scrollRef}>
        <div className="flex justify-end mb-4">
          <div
            className="bg-yellow-900/20 text-yellow-100 p-3 rounded-l-2xl rounded-tr-2xl text-sm border border-yellow-800/30 max-w-[80%]">
            ぜひ、ゆっくりお話しましょう。<br />招待状を送りますね。
          </div>
        </div>

        {messages.map(msg => (
          <div key={msg.id}>
            <MessageBubble
              message={msg}
              isMe={msg.senderId === 'me'}
            // onInteract={...}
            />
          </div>
        ))}
      </main>

      {/* Input Area (Custom with Drawer Trigger) */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3 pb-safe">
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="text-yellow-500 p-2 bg-yellow-900/20 rounded-full hover:bg-yellow-900/40 transition border border-yellow-800/50"
        >
          <Ticket className="w-5 h-5" />
        </button>
        <input
          type="text"
          placeholder="Message..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
          className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-slate-700 text-white"
        />
        <button onClick={handleSendText} className="text-slate-400 hover:text-white transition">
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Drawer */}
      <SmartInvitationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        onSend={handleSendInvitation}
      />
    </div>
  );
}
