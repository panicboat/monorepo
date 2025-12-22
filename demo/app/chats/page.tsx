import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function UserChatListPage() {
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen font-sans p-4">
      <header className="mb-6 flex items-center gap-2">
        <Link href="/home">
          <ChevronLeft className="w-6 h-6 text-slate-400" />
        </Link>
        <h1 className="text-xl font-bold text-white">Messages</h1>
      </header>

      <div className="space-y-2">
        <Link href="/chats/mirei" className="block p-4 bg-slate-900/50 rounded-xl hover:bg-slate-800 transition flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-700 rounded-full overflow-hidden">
            <img src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-baseline mb-1">
              <span className="font-bold text-white">美玲</span>
              <span className="text-xs text-yellow-500 font-bold">Unread</span>
            </div>
            <p className="text-sm text-slate-200 font-medium truncate">招待状が届きました 💌</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
