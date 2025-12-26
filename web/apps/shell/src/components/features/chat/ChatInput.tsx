"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
  onSend: (content: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend }) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText("");
  };

  return (
    <footer className="bg-slate-950 border-t border-slate-800 p-4 pb-8">
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <div className="flex-1 bg-slate-900 rounded-full border border-slate-700 flex items-center px-4 py-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="メッセージを入力..."
            className="bg-transparent w-full focus:outline-none text-sm text-white"
          />
        </div>
        <button type="submit" className="text-slate-500 hover:text-yellow-500 transition">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </footer>
  );
};
