"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Calendar,
  Ticket,
  Send,
  MoreVertical,
  ChevronLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface SmartInvitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (data: any) => void;
}

export default function SmartInvitationDrawer({
  isOpen,
  onClose,
  onSend,
}: SmartInvitationDrawerProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>("vip");
  const [selectedSlot, setSelectedSlot] = useState<string>("today");
  const [view, setView] = useState<"main" | "calendar">("main");
  const [customDate, setCustomDate] = useState<number | null>(null);

  const handleSend = () => {
    onSend({
      plan: selectedPlan,
      slot: selectedSlot === "custom" ? `Dec ${customDate} 21:00` : selectedSlot, // Mock time for custom
      message: "楽しみにしてます✨",
    });
    onClose();
  };

  // Calendar Mock Data
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const startOffset = 2;
  const isToday = (day: number) => day === 23;

  const handleDateSelect = (day: number) => {
    setCustomDate(day);
    setSelectedSlot("custom");
    setTimeout(() => setView("main"), 200); // Auto close after selection
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl z-50 border-t border-slate-700 flex flex-col max-h-[85vh] w-full"
          >
            <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
              <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
            </div>

            <div className="px-6 py-2 border-b border-slate-800 flex items-center">
              {view === "calendar" && (
                <button onClick={() => setView("main")} className="mr-3 text-slate-400">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-lg font-bold text-white flex items-center gap-2 font-serif-jp">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                {view === "main" ? "招待状を作成" : "日時を選択"}
              </h2>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              {view === "main" ? (
                <>
                  {/* Date Selection */}
                  <div>
                    <label className="text-xs text-slate-500 font-bold uppercase mb-3 block">
                      日時を選択
                    </label>

                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <button
                        onClick={() => setSelectedSlot("today")}
                        className={`bg-gradient-to-br from-green-900/40 to-slate-900 border text-left p-3 rounded-xl relative overflow-hidden group hover:scale-[1.02] transition
                        ${selectedSlot === "today"
                            ? "border-green-500"
                            : "border-slate-800"
                          }
                      `}
                      >
                        <div className="absolute top-0 right-0 bg-green-500 text-black text-[9px] font-bold px-2 py-0.5 rounded-bl">
                          Today
                        </div>
                        <p className="text-green-400 font-bold text-sm">
                          21:00 - 22:30
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          空き枠から自動提案
                        </p>
                      </button>

                      <button
                        onClick={() => setSelectedSlot("tomorrow")}
                        className={`bg-slate-800 border text-left p-3 rounded-xl hover:bg-slate-700 transition
                        ${selectedSlot === "tomorrow"
                            ? "border-green-500"
                            : "border-slate-700"
                          }
                      `}
                      >
                        <p className="text-white font-bold text-sm">明日 19:00~</p>
                        <p className="text-[10px] text-slate-500 mt-1">空き枠あり</p>
                      </button>
                    </div>

                    <button
                      onClick={() => setView("calendar")}
                      className={`w-full py-3 bg-slate-900 border rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition
                      ${selectedSlot === "custom" ? "border-green-500 text-green-400" : "border-slate-800 text-slate-400"}
                    `}
                    >
                      <Calendar className="w-4 h-4" />
                      {selectedSlot === "custom" && customDate ? `Dec ${customDate} (Selected)` : "その他の日時を指定"}
                    </button>
                  </div>

                  {/* Plan Selection */}
                  <div>
                    <label className="text-xs text-slate-500 font-bold uppercase mb-3 block">
                      プランを選択
                    </label>

                    <div className="space-y-2">
                      <div
                        onClick={() => setSelectedPlan("vip")}
                        className={`border rounded-xl p-3 flex justify-between items-center cursor-pointer transition
                        ${selectedPlan === "vip"
                            ? "bg-yellow-900/10 border-yellow-600"
                            : "bg-slate-800/50 border-slate-800"
                          }
                      `}
                      >
                        <div>
                          <p
                            className={`text-sm font-bold ${selectedPlan === "vip" ? "text-white" : "text-slate-300"
                              }`}
                          >
                            90分 VIPコース
                          </p>
                          <p className="text-xs text-yellow-600">¥35,000</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                          ${selectedPlan === "vip"
                              ? "border-yellow-500"
                              : "border-slate-600"
                            }
                        `}
                        >
                          {selectedPlan === "vip" && (
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                          )}
                        </div>
                      </div>

                      <div
                        onClick={() => setSelectedPlan("short")}
                        className={`border rounded-xl p-3 flex justify-between items-center cursor-pointer transition
                        ${selectedPlan === "short"
                            ? "bg-yellow-900/10 border-yellow-600"
                            : "bg-slate-800/50 border-slate-800 opacity-70"
                          }
                      `}
                      >
                        <div>
                          <p
                            className={`text-sm font-bold ${selectedPlan === "short"
                              ? "text-white"
                              : "text-slate-300"
                              }`}
                          >
                            60分 ショート
                          </p>
                          <p className="text-xs text-slate-500">¥20,000</p>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center
                          ${selectedPlan === "short"
                              ? "border-yellow-500"
                              : "border-slate-600"
                            }
                        `}
                        >
                          {selectedPlan === "short" && (
                            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-xs text-slate-500 font-bold uppercase mb-2 block">
                      一言メッセージ
                    </label>
                    <textarea
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white h-20 resize-none focus:border-yellow-600 focus:outline-none"
                      defaultValue="楽しみにしてます✨"
                    ></textarea>
                  </div>
                </>
              ) : (
                /* Calendar View */
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-4"
                >
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-lg font-bold text-white">December 2025</span>
                  </div>

                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-slate-500 uppercase font-bold mb-2">
                    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {Array.from({ length: startOffset }).map((_, i) => (
                      <div key={`offset-${i}`} className="h-10"></div>
                    ))}
                    {days.map((day) => {
                      const available = day === 20 || day === 21;
                      const hasBooking = day === 22;
                      const today = isToday(day);
                      const isSelected = customDate === day;

                      return (
                        <div
                          key={day}
                          onClick={() => handleDateSelect(day)}
                          className={`h-10 rounded-lg flex flex-col items-center justify-center relative cursor-pointer transition border
                            ${isSelected
                              ? "bg-green-600 border-green-400 text-white"
                              : today
                                ? "bg-slate-800 border-2 border-white"
                                : available
                                  ? "bg-green-900/20 border-green-500/50 text-green-400"
                                  : "bg-slate-900 border-slate-800 text-slate-500"
                            }
                          `}
                        >
                          <span className="text-sm font-bold">{day}</span>
                        </div>
                      )
                    })}
                  </div>

                  <div className="p-3 bg-slate-800/50 rounded-lg text-xs text-slate-400 mt-4">
                    ※ 実際の実装では時間枠（例: 21:00〜）の選択もここで行います。
                  </div>
                </motion.div>
              )}
            </div>

            {view === "main" && (
              <div className="p-4 border-t border-slate-800 bg-slate-900 pb-safe">
                <button
                  onClick={handleSend}
                  className="w-full bg-gradient-to-r from-yellow-700 to-yellow-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-yellow-900/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  招待状を送る
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
