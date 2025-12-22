import Link from "next/link";

export default function IndexPage() {
  return (
    <div className="bg-slate-950 text-slate-200 min-h-screen flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-wider font-serif">PrivateHeaven <span className="text-yellow-500">Dev</span></h1>
          <p className="text-slate-400 text-sm">Design System & Route Index</p>
        </div>

        <div className="space-y-6">

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">Entry</h3>
            <Link href="/login" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm mb-2">/login - Login / LP</Link>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">Cast App</h3>
            <div className="grid gap-2">
              <Link href="/cast/onboarding" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/cast/onboarding - Wizard</Link>
              <Link href="/cast/home" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/cast/home - Dashboard</Link>
              <Link href="/cast/chats/user1" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/cast/chats/[id] - Chat Room</Link>
              <Link href="/cast/mypage" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/cast/mypage - Settings</Link>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2 border-b border-slate-800 pb-1">User App</h3>
            <div className="grid gap-2">
              <Link href="/home" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/home - Discover & Following</Link>
              <Link href="/casts/mirei" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/casts/[id] - Cast Profile</Link>
              <Link href="/chats" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/chats - Chat List</Link>
              <Link href="/chats/mirei" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/chats/[id] - User Chat Room</Link>
              <Link href="/mypage" className="block p-3 bg-slate-900 rounded hover:bg-slate-800 transition text-sm">/mypage - History</Link>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
