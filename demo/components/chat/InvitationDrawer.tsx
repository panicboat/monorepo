"use client";

import React from "react";
import { Sparkles, Clock, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InvitationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
}

export const InvitationDrawer: React.FC<InvitationDrawerProps> = ({
  isOpen,
  onClose,
  onSend,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed inset-x-0 bottom-0 bg-slate-900 border-t border-yellow-800 rounded-t-3xl shadow-2xl z-30"
        >
          <div className="flex justify-center pt-3 pb-1" onClick={onClose}>
            <div className="w-12 h-1.5 bg-slate-700 rounded-full"></div>
          </div>

          <div className="p-6 pt-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-white text-lg flex items-center gap-2 font-[family-name:var(--font-geist-mono)]">
                <Sparkles className="text-yellow-500 w-4 h-4" />
                招待状を作成
              </h3>
              <button onClick={onClose} className="text-slate-500 text-sm hover:text-slate-300">閉じる</button>
            </div>

            <div className="mb-6">
              <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">日時を選択</label>
              <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar scrollbar-hide">
                <button className="px-4 py-2 rounded-lg bg-yellow-600 text-white text-xs font-bold whitespace-nowrap border border-yellow-500">
                  今日 (12/20)
                </button>
                <button className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs whitespace-nowrap border border-slate-700 hover:bg-slate-700">
                  明日 (12/21)
                </button>
                <button className="px-4 py-2 rounded-lg bg-slate-800 text-slate-400 text-xs whitespace-nowrap border border-slate-700 hover:bg-slate-700">
                  日付指定...
                </button>
              </div>
              <div className="flex gap-2 items-center bg-slate-950 p-3 rounded-xl border border-slate-800">
                <Clock className="text-yellow-600 w-4 h-4" />
                <select className="bg-transparent text-white font-mono text-lg focus:outline-none">
                  <option>20:00</option>
                  <option>21:00</option>
                  <option>22:00</option>
                </select>
                <span className="text-slate-600 mx-2">〜</span>
                <span className="text-slate-400 font-mono text-sm">22:30 (90min)</span>
              </div>
            </div>

            <div className="mb-8">
              <label className="text-xs text-slate-500 uppercase tracking-wider mb-2 block">プランを選択</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-800 border border-slate-700 opacity-50">
                  <div className="text-xs text-slate-400">Short</div>
                  <div className="font-bold text-white">60 min</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-800 border-2 border-yellow-600/50 relative">
                  <div className="absolute top-2 right-2 w-2 h-2 bg-yellow-500 rounded-full shadow-[0_0_8px_rgba(234,179,8,0.8)]"></div>
                  <div className="text-xs text-yellow-500">Standard</div>
                  <div className="font-bold text-white">90 min</div>
                </div>
              </div>
            </div>

            <button
              onClick={onSend}
              className="w-full bg-gradient-to-r from-yellow-700 to-yellow-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-yellow-900/30 flex items-center justify-center gap-2 active:scale-95 transition hover:from-yellow-600 hover:to-yellow-500"
            >
              <span>招待状を送る</span>
              <Send className="w-4 h-4" />
            </button>
            <p className="text-center text-[10px] text-slate-500 mt-3">
              ユーザーが承諾すると予約が確定します
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
