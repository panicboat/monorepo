"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "../hooks/useAuth";
import { GuestRadar } from "./GuestRadar";

export const GuestDashboard = () => {
  const { user, logout } = useAuth();

  // Mock Data
  const history = [
    { id: 1, cast: "Yuna", date: "2024-01-20 21:00", type: "Standard 60min", status: "sealed" },
    { id: 2, cast: "Mio", date: "2024-01-15 19:30", type: "Option: Cosplay", status: "completed" },
  ];

  return (
    <div className="bg-slate-50 pb-safe">
      <main className="p-6 space-y-8 pt-4">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 p-0.5 shadow-lg">
            <div className="h-full w-full rounded-full bg-white p-0.5">
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full rounded-full object-cover" /> : <div className="h-full w-full rounded-full bg-slate-100 flex items-center justify-center text-2xl">👤</div>}
            </div>
            <div className="absolute bottom-0 right-0 rounded-full bg-slate-900 border-2 border-white px-2 py-0.5 text-[10px] font-bold text-white">
              Silver
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif text-slate-900">{user?.name}</h2>
            <p className="text-xs text-slate-500 font-mono">ID: 99482103</p>
            {/* <div className="mt-2 flex items-center gap-4">
               <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Points</span>
                  <span className="text-lg font-bold text-pink-500 font-mono">1,405 <span className="text-xs">pt</span></span>
               </div>
               <div className="h-6 w-px bg-slate-200"></div>
               <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Tickets</span>
                  <span className="text-lg font-bold text-slate-700 font-mono">2</span>
               </div>
            </div> */}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Favorites", icon: "❤️", color: "bg-pink-50 text-pink-600", href: "/favorites" },
            { label: "Following", icon: "👥", color: "bg-blue-50 text-blue-600", href: "/following" },
            { label: "Footprints", icon: "🐾", color: "bg-orange-50 text-orange-600", href: "/footprints" },
            { label: "Blocking", icon: "⛔", color: "bg-slate-50 text-slate-600", href: "/blocking" },
          ].map(action => (
            <Link href={action.href} key={action.label} className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 shadow-sm border border-slate-100 transition-transform active:scale-95">
              <div className={`h-10 w-10 flex items-center justify-center rounded-full text-lg ${action.color}`}>
                {action.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-600">{action.label}</span>
            </Link>
          ))}
        </div>

        {/* Reliability Score Widget */}
        {/* Reliability Score Widget */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-white p-5 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none grayscale">
            <span className="text-6xl">🛡️</span>
          </div>

          <div className="flex items-center justify-between">
            {/* Left: Rank Badge */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Guest Reliability</h3>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold font-mono text-amber-500">A+</span>
                  <span className="text-sm font-medium text-slate-400">Excellent</span>
                </div>
                <div className="mt-1 text-[10px] text-slate-400 font-mono">
                  Score: 850 / 999
                </div>
              </div>
            </div>

            {/* Right: Radar Chart */}
            <div className="relative z-10">
              <GuestRadar scores={[90, 85, 95, 80, 100]} />
            </div>
          </div>

          {/* Bottom: Cast-facing Hint */}
          <div className="mt-2 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 italic flex items-center gap-2">
              <span className="text-amber-500">💡</span>
              "Very polite, punctual, and generous."
            </p>
          </div>
        </div>

        {/* Recent History Preview */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-sm text-slate-800">Recent Pledges</h3>
            <button className="text-xs font-bold text-pink-500">View All</button>
          </div>
          <div className="space-y-3">
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs">
                    {/* Placeholder Avatar */}
                    👩
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.cast}</div>
                    <div className="text-[10px] text-slate-400">{item.date} • {item.type}</div>
                  </div>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                            ${item.status === "sealed" ? "bg-red-100 text-red-600 border border-red-200" : "bg-slate-100 text-slate-500 border border-slate-200"}
                        `}>
                  {item.status}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Menu List */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          {[
            "Account Settings",
            "Notification Settings",
            "Payment Methods",
            "Help & Support",
            "Terms of Service"
          ].map((item, i) => (
            <button key={item} className={`w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors ${i !== 4 ? 'border-b border-slate-50' : ''}`}>
              <span>{item}</span>
              <span className="text-slate-300">›</span>
            </button>
          ))}
        </div>

        <button
          onClick={logout}
          className="w-full rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition-colors"
        >
          Sign Out
        </button>
      </main>
    </div>
  );
};
