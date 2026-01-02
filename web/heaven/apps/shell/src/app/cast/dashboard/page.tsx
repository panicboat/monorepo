"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { MoreHorizontal, Clock, Ticket, MessageCircle, Users } from "lucide-react";
import { CastBottomNav } from "@/components/navigation/CastBottomNav";
import { useRouter } from "next/navigation";
import { getCastProfile, updateCastStatus } from "@/app/actions/cast";
import { CastStatus } from "@heaven/rpc/cast/v1/service_pb";

type Status = "offline" | "asking" | "online" | "tonight";

export default function CastDashboardPage() {
  const [status, setStatus] = useState<Status>("offline");
  const router = useRouter();

  // Initial Fetch & Redirect
  useEffect(() => {
    const init = async () => {
      const data = await getCastProfile("1");
      if (!data || !data.profile) {
        // Profile not found, redirect to onboarding
        router.push("/cast/onboarding");
        return;
      }
      // Initial status sync
      if (data.profile.status) {
        // Map RPC status to UI status
        const rpcStatus = data.profile.status;
        let uiStatus: Status = "offline";
        if (rpcStatus === CastStatus.ONLINE) uiStatus = "online";
        else if (rpcStatus === CastStatus.TONIGHT) uiStatus = "tonight";
        else if (rpcStatus === CastStatus.ASKING) uiStatus = "asking";

        setStatus(uiStatus);
      }
    };
    init();
  }, [router]);

  // Map UI status to RPC status (Best effort for demo)
  const mapStatusToRpc = (s: Status): CastStatus => {
    switch (s) {
      case "online": return CastStatus.ONLINE;
      case "offline": return CastStatus.OFFLINE;
      case "tonight": return CastStatus.TONIGHT;
      case "asking": return CastStatus.ASKING;
      default: return CastStatus.UNSPECIFIED;
    }
  }

  const handleStatusChange = async (newStatus: Status) => {
    setStatus(newStatus);
    await updateCastStatus(mapStatusToRpc(newStatus));
  };

  const getStatusColor = (s: Status) => {
    switch (s) {
      case "online":
        return "bg-green-500 shadow-[0_0_8px_#22c55e]";
      case "tonight":
        return "bg-yellow-500 animate-pulse";
      case "asking":
        return "bg-purple-500";
      default:
        return "bg-slate-600";
    }
  };

  const getStatusTextColor = (s: Status) => {
    switch (s) {
      case "online":
        return "text-green-500";
      case "tonight":
        return "text-yellow-500";
      case "asking":
        return "text-purple-400";
      default:
        return "text-slate-400";
    }
  };

  return (
    <div className="bg-black text-slate-200 h-full font-sans flex flex-col">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 bg-slate-950 z-10 border-b border-slate-800">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold text-white tracking-wide font-serif-jp">
            Dashboard
          </h1>

          <div className="flex items-center gap-3 bg-slate-900 rounded-full p-1 border border-slate-800 pr-4">
            <div
              className={`w-3 h-3 rounded-full ml-3 transition-colors duration-300 ${getStatusColor(status)}`}
            ></div>
            <select
              value={status}
              onChange={(e) => handleStatusChange(e.target.value as Status)}
              className={`bg-transparent text-xs font-bold focus:outline-none appearance-none cursor-pointer ${getStatusTextColor(status)}`}
            >
              <option value="offline">⚪ Offline</option>
              <option value="asking">🟣 Asking (相談可)</option>
              <option value="online">🟢 Online (即レス)</option>
              <option value="tonight">🟡 Tonight (今夜空き)</option>
            </select>
          </div>
        </div>

        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl p-3 min-w-[100px]">
            <p className="text-[10px] text-slate-500 uppercase">Promise Rate</p>
            <p className="text-lg font-bold text-yellow-500">
              100<span className="text-xs">%</span>
            </p>
          </div>
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl p-3 min-w-[100px]">
            <p className="text-[10px] text-slate-500 uppercase">Followers</p>
            <p className="text-lg font-bold text-white">
              24<span className="text-xs text-green-500 ml-1">▲2</span>
            </p>
          </div>
          <div className="flex-1 bg-slate-900/50 border border-slate-800 rounded-xl p-3 min-w-[100px]">
            <p className="text-[10px] text-slate-500 uppercase">Unread</p>
            <p className="text-lg font-bold text-red-400">3</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto no-scrollbar px-4 pb-24 pt-4">
        {/* Today's Promise */}
        <div className="mb-6">
          <p className="text-xs text-slate-500 font-bold mb-3 flex items-center gap-2">
            TODAY&apos;S PROMISE
            <span className="w-full h-px bg-slate-800"></span>
          </p>

          <div className="relative bg-gradient-to-br from-slate-900 to-slate-950 border border-yellow-700/50 rounded-xl p-4 shadow-lg shadow-yellow-900/10 overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500"></div>
            <div className="absolute -right-4 -top-4 w-20 h-20 bg-yellow-500/10 rounded-full blur-xl"></div>

            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="bg-yellow-900/30 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-700/50">
                  CONFIRMED
                </span>
                <span className="text-xs text-slate-400">あと 2時間</span>
              </div>
              <button className="text-slate-500 hover:text-white">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-lg font-bold text-white border border-slate-700">
                T
              </div>
              <div className="flex-1">
                <h3 className="text-lg text-white font-bold font-serif-jp">
                  Takuya 様
                </h3>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Clock className="w-3 h-3 text-yellow-600" />
                  <span>21:00 - 22:30 (90min)</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 bg-slate-800 hover:bg-slate-700 text-xs text-white py-2 rounded-lg border border-slate-700 transition">
                詳細を見る
              </button>
              <button className="flex-1 bg-yellow-900/20 hover:bg-yellow-900/30 text-xs text-yellow-500 py-2 rounded-lg border border-yellow-800/50 transition flex items-center justify-center">
                チャットへ
              </button>
            </div>
          </div>
        </div>

        {/* Recent Chats */}
        <div>
          <div className="flex justify-between items-end mb-3">
            <p className="text-xs text-slate-500 font-bold">RECENT CHATS</p>
            <button className="text-[10px] text-yellow-600 hover:text-yellow-500">
              All History
            </button>
          </div>

          <div className="space-y-2">
            {/* Kenji - Unread */}
            <Link href="/cast/chats/kenji">
              <div className="bg-slate-900/80 hover:bg-slate-800 border border-slate-800/50 p-3 rounded-xl flex gap-3 cursor-pointer transition relative">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-indigo-900 flex items-center justify-center text-sm font-bold text-indigo-100">
                    K
                  </div>
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white truncate">Kenji</h3>
                      <span className="text-[10px] text-yellow-500 bg-yellow-900/20 px-1.5 rounded border border-yellow-800/30 truncate max-w-[80px]">
                        ワイン好き
                      </span>
                    </div>
                    <span className="text-[10px] text-green-400 font-bold">
                      2m ago
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 font-bold truncate">
                    今夜空いてたりする？久々に...
                  </p>
                </div>
              </div>
            </Link>

            {/* Masato - Invitation Sent */}
            <div className="bg-slate-900/40 hover:bg-slate-800 border border-slate-800/50 p-3 rounded-xl flex gap-3 cursor-pointer transition">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-sm font-bold text-slate-400">
                M
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-300">Masato</h3>
                    <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 rounded">
                      初回
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">1h ago</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-yellow-600/80">
                  <Ticket className="w-3 h-3" />
                  <span>招待状を送付しました</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <CastBottomNav />
    </div>
  );
}
