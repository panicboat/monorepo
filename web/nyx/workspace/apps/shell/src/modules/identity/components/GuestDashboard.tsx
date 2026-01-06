"use client";

import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

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
        {/* Profile Card */}
        <div className="flex items-center gap-4 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="h-full w-full rounded-full" /> : "👤"}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{user?.name}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500"></span>
              <span>Guest Member</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-slate-900">12</div>
            <div className="text-xs text-slate-400">Pledges</div>
          </div>
          <div className="rounded-2xl bg-white p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-pink-500">98%</div>
            <div className="text-xs text-slate-400">Trust Score</div>
          </div>
        </div>

        {/* History */}
        <section>
          <h3 className="mb-4 text-sm font-bold text-slate-400 uppercase tracking-wider">Recent Pledges</h3>
          <div className="space-y-3">
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-slate-100"
              >
                <div>
                  <div className="font-bold text-slate-800">{item.cast}</div>
                  <div className="text-xs text-slate-500">{item.date}</div>
                </div>
                <div className={`px-2 py-1 rounded text-xs font-bold uppercase
                            ${item.status === "sealed" ? "bg-red-100 text-red-800" : "bg-slate-100 text-slate-800"}
                        `}>
                  {item.status}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <button
          onClick={logout}
          className="w-full rounded-xl border border-red-100 bg-red-50 py-3 text-sm font-bold text-red-500 hover:bg-red-100 transition-colors"
        >
          Sign Out
        </button>
      </main>
    </div>
  );
};
