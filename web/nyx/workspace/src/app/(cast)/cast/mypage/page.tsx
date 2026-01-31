"use client";

import Link from "next/link";
import {
  ImagePlus,
  Users,
  Ticket,
  ShieldAlert,
  LogOut,
  Star,
  History as HistoryIcon,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/modules/identity/hooks/useAuth";

export default function CastMyPage() {
  const { logout } = useAuth();

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900">
      <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        <p className="text-xs text-slate-500 font-bold uppercase ml-2 mb-1">
          Manage
        </p>

        <Link
          href="/cast/profile"
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-500">
              <ImagePlus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                プロフィール編集
              </p>
              <p className="text-xs text-slate-500">写真・動画・タグの管理</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </Link>

        <Link
          href="/cast/plans"
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                プラン設定
              </p>
              <p className="text-xs text-slate-500">コース内容・料金の編集</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </Link>

        <button className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center text-yellow-500">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                フォロワーリスト
              </p>
              <p className="text-xs text-slate-500">顧客メモの管理・営業</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </button>

        <Link
          href="/cast/reviews"
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <Star className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">レビュー管理</p>
              <p className="text-xs text-slate-500">ゲストからの評価・承認</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </Link>

        <Link
          href="/cast/history"
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">履歴・売上</p>
              <p className="text-xs text-slate-500">過去の予約履歴</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </Link>

        <p className="text-xs text-slate-500 font-bold uppercase ml-2 mb-1 mt-4">
          Account
        </p>

        <button className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">ブロックリスト</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </button>

        <button
          onClick={logout}
          className="w-full p-4 flex items-center gap-3 text-red-500 hover:text-red-600 transition justify-center mt-4"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-bold">ログアウト</span>
        </button>
      </main>
    </div>
  );
}
