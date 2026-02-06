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
    <div className="flex flex-col h-full bg-surface-secondary text-text-primary">
      <main className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        <p className="text-xs text-text-secondary font-bold uppercase ml-2 mb-1">
          Manage
        </p>

        <Link
          href="/cast/profile"
          className="w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-role-cast-lighter flex items-center justify-center text-role-cast">
              <ImagePlus className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">
                プロフィール編集
              </p>
              <p className="text-xs text-text-secondary">写真・動画・タグの管理</p>
            </div>
          </div>
          <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
        </Link>

        <Link
          href="/cast/plans"
          className="w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-special-lighter flex items-center justify-center text-special">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">
                プラン設定
              </p>
              <p className="text-xs text-text-secondary">コース内容・料金の編集</p>
            </div>
          </div>
          <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
        </Link>

        <button className="w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning-lighter flex items-center justify-center text-warning">
              <Users className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">
                フォロワーリスト
              </p>
              <p className="text-xs text-text-secondary">顧客メモの管理・営業</p>
            </div>
          </div>
          <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
        </button>

        <Link
          href="/cast/reviews"
          className="w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-warning-lighter flex items-center justify-center text-warning">
              <Star className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">レビュー管理</p>
              <p className="text-xs text-text-secondary">ゲストからの評価・承認</p>
            </div>
          </div>
          <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
        </Link>

        <Link
          href="/cast/history"
          className="w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-special-lighter flex items-center justify-center text-special">
              <HistoryIcon className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">履歴・売上</p>
              <p className="text-xs text-text-secondary">過去の予約履歴</p>
            </div>
          </div>
          <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
        </Link>

        <p className="text-xs text-text-secondary font-bold uppercase ml-2 mb-1 mt-4">
          Account
        </p>

        <button className="w-full bg-surface hover:bg-surface-secondary border border-border rounded-xl p-4 flex items-center justify-between group transition shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-secondary flex items-center justify-center text-text-secondary">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-text-primary">ブロックリスト</p>
            </div>
          </div>
          <ChevronRight className="text-text-muted group-hover:text-text-secondary transition" />
        </button>

        <button
          onClick={logout}
          className="w-full p-4 flex items-center gap-3 text-error hover:text-error-hover transition justify-center mt-4"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-xs font-bold">ログアウト</span>
        </button>
      </main>
    </div>
  );
}
