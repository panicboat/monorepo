"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Settings,
  Camera,
  BadgeCheck,
  ExternalLink,
  ImagePlus,
  Users,
  Ticket,
  ShieldAlert,
  LogOut,
  LayoutList,
  Star,
  History as HistoryIcon,
  ChevronRight,
} from "lucide-react";
import { CastProfile } from "@/modules/portfolio/types";
import { useAuth } from "@/modules/identity/hooks/useAuth";

interface MyPageStats {
  sales: number;
  followers: number;
  promiseRate: number;
}

export default function CastMyPage() {
  const [profile, setProfile] = useState<CastProfile | null>(null);
  const [stats, setStats] = useState<MyPageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const { logout } = useAuth();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileRes, statsRes] = await Promise.all([
          fetch("/api/cast/profile"),
          fetch("/api/cast/mypage"),
        ]);

        if (profileRes.ok && statsRes.ok) {
          const profileData = await profileRes.json();
          const statsData = await statsRes.json();
          setProfile(profileData);
          setStats(statsData);
        }
      } catch (error) {
        console.error("Failed to fetch mypage data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-slate-50 p-6 items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4 w-full">
          <div className="h-20 w-20 bg-slate-200 rounded-full"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
          <div className="h-24 w-full max-w-sm bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!profile || !stats) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 text-slate-900">
      {/* Header Section */}
      <div className="p-6 pb-8 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-slate-900">Backstage</h1>
          <button className="text-slate-400 hover:text-slate-600 transition">
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden">
              <img
                src={
                  profile.images?.hero ||
                  "https://placehold.co/200x200/e2e8f0/64748b?text=User"
                }
                alt="Profile"
                className="w-full h-full object-cover"
              />
            </div>
            <button className="absolute bottom-0 right-0 bg-white p-1.5 rounded-full border border-slate-200 text-slate-600 hover:bg-slate-50 transition shadow-sm">
              <Camera className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-serif font-bold text-slate-900">
                {profile.name}
              </h2>
              <BadgeCheck className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />
            </div>
            <Link
              href={`/cast/${profile.id}`}
              className="text-xs text-yellow-600 flex items-center gap-1 hover:text-yellow-500 transition font-bold"
              target="_blank"
            >
              <span>プロフィールをプレビュー</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="px-4 -mt-6 z-10">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex justify-around">
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase mb-1 font-bold">
              Total Sales
            </p>
            <p className="text-xl font-bold text-slate-900 font-mono">
              ¥{(stats.sales / 1000).toLocaleString()}
              <span className="text-sm text-slate-500">k</span>
            </p>
          </div>
          <div className="w-px bg-slate-100 h-10 self-center"></div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase mb-1 font-bold">
              Followers
            </p>
            <p className="text-xl font-bold text-slate-900 font-mono">
              {stats.followers}
            </p>
          </div>
          <div className="w-px bg-slate-100 h-10 self-center"></div>
          <div className="text-center">
            <p className="text-[10px] text-slate-500 uppercase mb-1 font-bold">
              Promise Rate
            </p>
            <p className="text-xl font-bold text-green-500 font-mono">
              {stats.promiseRate}
              <span className="text-sm">%</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Menu */}
      <main className="flex-1 overflow-y-auto p-4 space-y-3 mt-4 pb-24">
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

        {/* Followers List */}
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
          href="/cast/plans"
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500">
              <Ticket className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                招待状プラン設定
              </p>
              <p className="text-xs text-slate-500">コース内容・料金の編集</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </Link>

        {/* Engagement Features */}
        <Link
          href="/cast/timeline"
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">
              <LayoutList className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                タイムライン投稿
              </p>
              <p className="text-xs text-slate-500">日々の投稿管理</p>
            </div>
          </div>
          <ChevronRight className="text-slate-400 group-hover:text-slate-600 transition" />
        </Link>

        <Link
          href="/cast/reviews"
          className="w-full bg-white hover:bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between group transition shadow-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
              <Star className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-slate-900">
                レビュー管理
              </p>
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
              <p className="text-sm font-bold text-slate-900">
                履歴・売上
              </p>
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
              <p className="text-sm font-bold text-slate-900">
                ブロックリスト
              </p>
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
