"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Send } from "lucide-react";

type Message = {
  id: string;
  sender: "user" | "cast";
  text: string;
  time: string;
  read: boolean;
};

const MOCK_MESSAGES: Record<string, Message[]> = {
  "1": [
    {
      id: "1",
      sender: "user",
      text: "Thank you for the performance today!",
      time: "21:00",
      read: true,
    },
    {
      id: "2",
      sender: "cast",
      text: "Thank you too! 💖 I was so happy you came.",
      time: "21:05",
      read: true,
    },
    {
      id: "3",
      sender: "user",
      text: "I'll pledge again next week.",
      time: "21:10",
      read: true,
    },
    {
      id: "4",
      sender: "cast",
      text: "Really? I'm waiting for you! 😘",
      time: "21:12",
      read: true,
    },
  ],
  "2": [
    {
      id: "1",
      sender: "cast",
      text: "Are you free tonight?",
      time: "18:00",
      read: true,
    },
  ],
  default: [
    {
      id: "1",
      sender: "cast",
      text: "Hello! Nice to meet you.",
      time: "12:00",
      read: true,
    },
  ],
};

export const ChatRoom = ({ castId }: { castId: string }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const thread = MOCK_MESSAGES[castId] || MOCK_MESSAGES["default"];
    setMessages(thread);
  }, [castId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputText,
      time: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      read: false,
    };

    setMessages([...messages, newMessage]);
    setInputText("");

    // Mock Auto Reply
    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: "cast",
        text: "Thank you for your message! 💌 (Auto Reply)",
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        read: true,
      };
      setMessages((prev) => [...prev, reply]);
    }, 1500);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Messages Area */}
      <div className="flex-1 space-y-4 p-4 pb-48">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm font-medium ${
                msg.sender === "user"
                  ? "bg-slate-900 text-white rounded-br-none"
                  : "bg-slate-100 text-slate-800 rounded-bl-none"
              }`}
            >
              <p>{msg.text}</p>
              <div
                className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${msg.sender === "user" ? "text-slate-400" : "text-slate-400"}`}
              >
                <span>{msg.time}</span>
                {msg.sender === "user" && msg.read && <span>Read</span>}
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="sticky bottom-20 md:bottom-0 z-40 bg-white p-4 border-t border-slate-100">
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                handleSend();
              }
            }}
            placeholder="Send a message..."
            className="flex-1 bg-transparent text-sm placeholder:text-slate-300 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!inputText.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-500 text-white transition-all disabled:opacity-50 disabled:bg-slate-300"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
