"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Search, Bell, MailOpen } from "lucide-react";
import { motion } from "framer-motion";

type Tab = "All" | "Invitations" | "Unread";

export default function UserChatListPage() {
  const [activeTab, setActiveTab] = useState<Tab>("All");

  return (
    <div className="flex flex-col h-full bg-slate-950">
      {/* Header */}
      <header className="px-5 pt-6 pb-2 bg-slate-950/90 backdrop-blur z-10 sticky top-0 border-b border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h1
            className="text-xl font-bold text-white tracking-wide font-serif-jp"
          >
            Messages
          </h1>
          <div className="flex gap-4">
            <button>
              <Search className="w-5 h-5 text-slate-400" />
            </button>
            <div className="relative">
              <Bell className="w-5 h-5 text-slate-400" />
              <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-slate-950"></div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 text-sm font-bold border-b border-slate-800">
          <button
            onClick={() => setActiveTab("All")}
            className={`pb-2 transition ${activeTab === "All"
              ? "text-white border-b-2 border-yellow-500"
              : "text-slate-500 hover:text-slate-300"
              }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab("Invitations")}
            className={`pb-2 transition flex items-center ${activeTab === "Invitations"
              ? "text-white border-b-2 border-yellow-500"
              : "text-slate-500 hover:text-slate-300"
              }`}
          >
            Invitations
            <span className="text-[10px] bg-yellow-900/50 text-yellow-500 px-1.5 rounded-full ml-1">
              1
            </span>
          </button>
          <button
            onClick={() => setActiveTab("Unread")}
            className={`pb-2 transition ${activeTab === "Unread"
              ? "text-white border-b-2 border-yellow-500"
              : "text-slate-500 hover:text-slate-300"
              }`}
          >
            Unread
          </button>
        </div>
      </header>

      {/* Main List */}
      <main className="flex-1 overflow-y-auto no-scrollbar p-2">
        {/* Invitation Item */}
        {(activeTab === "All" || activeTab === "Invitations") && (
          <Link href="/guest/chats/mirei" className="block mb-2">
            <motion.div
              animate={{
                borderColor: ["rgba(234, 179, 8, 0.4)", "rgba(234, 179, 8, 1)", "rgba(234, 179, 8, 0.4)"],
                boxShadow: [
                  "0 0 5px rgba(234, 179, 8, 0.1)",
                  "0 0 15px rgba(234, 179, 8, 0.3)",
                  "0 0 5px rgba(234, 179, 8, 0.1)",
                ],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="relative bg-slate-900 border border-yellow-500/30 rounded-xl p-4 cursor-pointer group transition"
            >
              <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg shadow-lg shadow-yellow-500/20">
                INVITATION
              </div>

              <div className="flex gap-4 items-center">
                <div className="relative">
                  <div
                    className="w-14 h-14 rounded-full bg-slate-800 bg-cover border-2 border-yellow-500/50"
                    style={{
                      backgroundImage:
                        "url('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100')",
                    }}
                  ></div>
                  <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-yellow-500 border-2 border-slate-900 rounded-full animate-pulse"></div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-white text-base">美玲</h3>
                    <span className="text-[10px] text-yellow-500 font-bold">Just now</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white font-bold text-xs">
                    <MailOpen className="w-3 h-3 text-yellow-500 fill-yellow-500/20" />
                    <span>あなたへの招待状が届きました</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </Link>
        )}

        {/* Normal Chats */}
        {(activeTab === "All" || activeTab === "Unread") && (
          <Link href="/guest/chats/jessica" className="block mb-2">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex gap-3 cursor-pointer hover:bg-slate-800 transition">
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-full bg-slate-800 bg-cover border border-slate-700"
                  style={{
                    backgroundImage:
                      "url('https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100')",
                  }}
                ></div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-1">
                  <h3 className="font-bold text-slate-200">Jessica</h3>
                  <span className="text-[10px] text-green-400">5m ago</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-white truncate pr-2">
                    来週の金曜日なら空いてます！...
                  </p>
                  <div className="w-4 h-4 rounded-full bg-red-500 text-[9px] text-white flex items-center justify-center font-bold">
                    2
                  </div>
                </div>
              </div>
            </div>
          </Link>
        )}

        {activeTab === "All" && (
          <div className="bg-slate-950 border border-slate-800/50 rounded-xl p-3 mb-2 flex gap-3 cursor-pointer opacity-80 hover:opacity-100 transition">
            <div className="relative">
              <div
                className="w-12 h-12 rounded-full bg-slate-800 bg-cover grayscale border border-slate-800"
                style={{
                  backgroundImage:
                    "url('https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100')",
                }}
              ></div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-slate-600 border-2 border-slate-900 rounded-full"></div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-baseline mb-1">
                <h3 className="font-bold text-slate-400">Yuna</h3>
                <span className="text-[10px] text-slate-600">Yesterday</span>
              </div>
              <p className="text-xs text-slate-500 truncate">またお願いします😊</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
