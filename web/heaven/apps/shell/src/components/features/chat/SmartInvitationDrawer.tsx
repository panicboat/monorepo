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
  const [view, setView] = useState<"main" | "picker">("main");

  // Custom Picker State
  const [customDate, setCustomDate] = useState<number>(23); // Default Today
  const [customTime, setCustomTime] = useState<string | null>(null);

  const handleSend = () => {
    onSend({
      plan: selectedPlan,
      slot: selectedSlot === "custom" ? `Dec ${customDate} ${customTime}` : selectedSlot,
      message: "楽しみにしてます✨",
    });
    onClose();
  };

  const handleCustomConfirm = () => {
    if (customTime) {
      setSelectedSlot("custom");
      setView("main");
    }
  };

  const dates = [
    { day: 23, label: "Today", active: true },
    { day: 24, label: "Wed", active: false },
    { day: 25, label: "Thu", active: false },
    { day: 26, label: "Fri", active: false },
    { day: 27, label: "Sat", active: false },
  ];

  const times = ["21:00", "21:30", "22:00", "22:30"];
  const disabledTimes = ["19:00", "19:30", "20:00", "20:30"];

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
            className="absolute bottom-0 left-0 right-0 bg-slate-900 rounded-t-3xl z-50 border-t border-slate-700 flex flex-col h-[600px] max-h-[90vh] w-full"
          >
            <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
              <div className="w-12 h-1.5 bg-slate-700 rounded-full" />
            </div>

            <div className="px-6 py-2 border-b border-slate-800 flex items-center justify-between h-12 shrink-0">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 font-serif-jp">
                {view === "picker" ? (
                  <>
                    <Calendar className="w-4 h-4 text-white" />
                    日時を指定
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-yellow-500" />
                    招待状を作成
                  </>
                )}
              </h2>
              {view === "picker" && (
                <button
                  onClick={() => setView("main")}
                  className="text-xs text-slate-400 font-bold flex items-center gap-1 hover:text-white"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
              )}
            </div>

            {/* View Container */}
            <div className="relative flex-1 overflow-hidden">

              {/* Main View */}
              <motion.div
                className="absolute inset-0 p-6 overflow-y-auto space-y-6"
                initial={{ x: 0 }}
                animate={{ x: view === "main" ? 0 : "-100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              >
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
                    onClick={() => setView("picker")}
                    className={`w-full py-3 bg-slate-900 border rounded-xl text-slate-400 text-xs flex items-center justify-center gap-2 hover:bg-slate-800 transition
                      ${selectedSlot === "custom" ? "border-green-500 text-green-400" : "border-slate-800"}
                    `}
                  >
                    <Calendar className="w-4 h-4" />
                    {selectedSlot === "custom" && customTime
                      ? `Dec ${customDate} ${customTime} (Selected)`
                      : "その他の日時を指定"
                    }
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
              </motion.div>

              {/* Picker View */}
              <motion.div
                className="absolute inset-0 p-6 flex flex-col"
                initial={{ x: "100%" }}
                animate={{ x: view === "picker" ? 0 : "100%" }}
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              >
                <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6 pb-2 shrink-0">
                  {dates.map((date) => (
                    <button
                      key={date.day}
                      onClick={() => setCustomDate(date.day)}
                      className={`flex-shrink-0 w-14 h-16 rounded-xl flex flex-col items-center justify-center border transition
                        ${customDate === date.day
                          ? "bg-yellow-600 border-yellow-500 shadow-lg shadow-yellow-900/30"
                          : "bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700"
                        }
                      `}
                    >
                      <span className={`text-[10px] font-bold ${customDate === date.day ? "text-yellow-100" : ""}`}>
                        {date.label}
                      </span>
                      <span className={`text-lg font-bold ${customDate === date.day ? "text-white" : ""}`}>
                        {date.day}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto">
                  <label className="text-xs text-slate-500 font-bold uppercase mb-3 block">
                    開始時間を選択
                  </label>
                  <div className="grid grid-cols-4 gap-3 pb-4">
                    {disabledTimes.map(time => (
                      <button
                        key={time}
                        disabled
                        className="py-2 rounded-lg bg-slate-800 text-slate-500 text-xs border border-slate-700 line-through cursor-not-allowed"
                      >
                        {time}
                      </button>
                    ))}
                    {times.map(time => (
                      <button
                        key={time}
                        onClick={() => setCustomTime(time)}
                        className={`py-2 rounded-lg text-xs border transition
                            ${customTime === time
                            ? "bg-yellow-600 text-black font-bold border-yellow-500 shadow-lg shadow-yellow-500/20"
                            : "bg-slate-900 text-white border-slate-600 hover:bg-yellow-900/30 hover:border-yellow-600 hover:text-yellow-500"
                          }
                          `}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleCustomConfirm}
                  className="mt-4 w-full py-3 bg-slate-800 text-white font-bold rounded-xl text-sm border border-slate-700 hover:bg-slate-700 shrink-0"
                >
                  決定する
                </button>
              </motion.div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 z-10 shrink-0 pb-safe">
              <button
                onClick={handleSend}
                className="w-full bg-gradient-to-r from-yellow-700 to-yellow-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-yellow-900/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                招待状を送る
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
