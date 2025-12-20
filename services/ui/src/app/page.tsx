"use client";

import Link from "next/link";
import { User, MessageCircle, HeartHandshake } from "lucide-react";

export default function Home() {
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-wider font-[family-name:var(--font-geist-mono)]">PrivateHeaven <span className="text-yellow-500">v2</span></h1>
          <p className="text-slate-400 text-sm">Development Preview</p>
        </div>

        <div className="grid gap-4">
          <Link href="/cast" className="group relative block p-6 bg-slate-900 rounded-2xl border border-slate-800 hover:border-yellow-600/50 transition-all active:scale-95">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-yellow-900/20 transition-colors">
                <User className="w-6 h-6 text-slate-400 group-hover:text-yellow-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">Cast Profile</h2>
                <p className="text-xs text-slate-500">キャストプロフィール画面 (美玲)</p>
              </div>
              <div className="ml-auto">
                <span className="text-xs bg-slate-800 border-slate-700 border px-2 py-1 rounded text-slate-400">/cast</span>
              </div>
            </div>
          </Link>

          <Link href="/chat" className="group relative block p-6 bg-slate-900 rounded-2xl border border-slate-800 hover:border-yellow-600/50 transition-all active:scale-95">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center group-hover:bg-yellow-900/20 transition-colors">
                <MessageCircle className="w-6 h-6 text-slate-400 group-hover:text-yellow-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-yellow-400 transition-colors">Chat Screen</h2>
                <p className="text-xs text-slate-500">チャット・招待状作成画面</p>
              </div>
              <div className="ml-auto">
                <span className="text-xs bg-slate-800 border-slate-700 border px-2 py-1 rounded text-slate-400">/chat</span>
              </div>
            </div>
          </Link>

          <div className="p-4 rounded-xl border border-slate-800/50 bg-slate-900/30 text-center">
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mb-2">
              <HeartHandshake className="w-4 h-4" />
              <span>Core Experience</span>
            </div>
            <p className="text-xs text-slate-400">
              プロフィールの閲覧 &rarr; チャットでのやり取り &rarr; 招待状の作成 &rarr; 誓約(Ritual)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
