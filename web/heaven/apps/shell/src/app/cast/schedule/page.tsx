"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Trash2,
  MessageCircle,
  Users,
  Calendar,
} from "lucide-react";
import { motion } from "framer-motion";
import { CastBottomNav } from "@/components/navigation/CastBottomNav";

export default function CastSchedulePage() {
  const [selectedDate, setSelectedDate] = useState(23); // Mock: Default to 23rd

  // Mock Calendar Grid Generation
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const startOffset = 2; // Mock: Month starts on Tuesday (for Dec 2025 example)

  const isToday = (day: number) => day === 23;

  return (
    <div className="bg-slate-950 text-slate-200 h-screen font-sans flex justify-center pb-20">
      <div className="w-full max-w-md bg-slate-950 h-full relative shadow-2xl flex flex-col">
        {/* Header */}
        <header className="px-5 pt-6 pb-4 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wide font-serif-jp">
              Schedule
            </h1>
            <p className="text-xs text-slate-500">
              Manage your &quot;Princess Time&quot;
            </p>
          </div>
          <button className="bg-slate-800 p-2 rounded-full text-slate-400 hover:text-white transition">
            <CalendarPlus className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar p-4 pb-24">
          <div className="flex justify-between items-center mb-6 px-2">
            <button>
              <ChevronLeft className="text-slate-500" />
            </button>
            <span className="text-lg font-bold text-white">December 2025</span>
            <button>
              <ChevronRight className="text-slate-500" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-slate-500 uppercase font-bold mb-2">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-8">
            {/* Empty slots for start offset */}
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`offset-${i}`} className="h-12 rounded-lg bg-transparent"></div>
            ))}

            {days.map((day) => {
              const available = day === 20 || day === 21;
              const hasBooking = day === 22;
              const today = isToday(day);

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(day)}
                  className={`h-12 rounded-lg flex flex-col items-center justify-center relative cursor-pointer transition border
                    ${today
                      ? "bg-slate-800 border-2 border-white"
                      : available
                        ? "bg-green-900/20 border-green-500/50"
                        : hasBooking
                          ? "bg-slate-900 border-yellow-600 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
                          : "bg-slate-900 border-slate-800 text-slate-500"
                    }
                  `}
                >
                  <span
                    className={`text-sm font-bold ${available
                      ? "text-green-400"
                      : hasBooking || today
                        ? "text-white"
                        : "text-slate-500"
                      }`}
                  >
                    {day}
                  </span>
                  {available && (
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1"></div>
                  )}
                  {hasBooking && (
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 mt-1"></div>
                  )}
                  {today && (
                    <span className="text-[8px] text-slate-400 absolute bottom-1">
                      Today
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Details Panel */}
          {selectedDate === 23 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/80 border border-slate-800 rounded-xl p-4"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-white flex items-center gap-2">
                  <Clock className="w-4 h-4 text-green-500" />
                  Dec {selectedDate} (Today)
                </h3>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <div className="w-8 h-4 bg-slate-700 rounded-full relative">
                    <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                  Available
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm text-center font-mono">
                    21:00 - 23:00
                  </div>
                  <button className="text-slate-500 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <button className="w-full py-3 border border-dashed border-slate-700 rounded-lg text-slate-500 text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  Add Time Slot
                </button>
              </div>

              <div className="mt-6 bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-full">
                  {/* Google Calendar Icon Mock */}
                  <img
                    src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Google_Calendar_icon_%282020%29.svg"
                    className="w-4 h-4"
                    alt="Google Calendar"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-bold text-blue-200">
                    Sync with Google Calendar
                  </p>
                  <p className="text-[10px] text-blue-400">
                    プライベートの予定を自動で除外します
                  </p>
                </div>
                <div className="w-8 h-4 bg-slate-700 rounded-full relative">
                  <div className="absolute left-0.5 top-0.5 w-3 h-3 bg-slate-400 rounded-full"></div>
                </div>
              </div>
            </motion.div>
          )}
        </main>

        <CastBottomNav />
      </div>
    </div>
  );
}
