import Link from "next/link";
import { MessageCircle, Settings, Users } from "lucide-react";

export default function CastHomePage() {
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen font-sans p-4">
      <header className="mb-6 flex justify-between items-center">
        <h1 className="text-xl font-bold text-white">Cast Dashboard</h1>
        <Link href="/cast/mypage" className="p-2 bg-slate-900 rounded-full">
          <Settings className="w-5 h-5 text-slate-400" />
        </Link>
      </header>

      <div className="space-y-4">
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800">
          <h2 className="text-sm text-slate-500 mb-2">Today's Appointment</h2>
          <p className="text-center text-slate-400 py-4">No appointments yet.</p>
        </div>

        <h2 className="text-lg font-bold text-white mt-8 mb-2">Chats</h2>
        <div className="space-y-2">
          <Link href="/cast/chats/user1" className="block p-4 bg-slate-900/50 rounded-xl hover:bg-slate-800 transition flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-900 rounded-full flex items-center justify-center text-white font-bold">T</div>
            <div className="flex-1">
              <div className="flex justify-between items-baseline mb-1">
                <span className="font-bold text-white">Takuya</span>
                <span className="text-xs text-slate-500">10:42 AM</span>
              </div>
              <p className="text-sm text-slate-400 truncate">21時大丈夫ですよ✨ 招待状送りますね！</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
