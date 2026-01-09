"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { GuestRadar } from "./GuestRadar";
import { ReviewForm } from "@/modules/trust/components/guest/ReviewForm";

export const GuestDashboard = () => {
  const { user, logout } = useAuth();

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewTarget, setSelectedReviewTarget] = useState<{
    id: number;
    cast: string;
  } | null>(null);

  // Mock Data
  const [pendingReviews, setPendingReviews] = useState([
    {
      id: 101,
      cast: "Yuna",
      date: "Today 21:00",
      type: "Standard 60min",
      isPastDue: true,
    },
  ]);

  const history = [
    {
      id: 1,
      cast: "Yuna",
      date: "2024-01-20 21:00",
      type: "Standard 60min",
      status: "sealed",
    },
    {
      id: 2,
      cast: "Mio",
      date: "2024-01-15 19:30",
      type: "Option: Cosplay",
      status: "completed",
    },
  ];

  const openReviewModal = (item: { id: number; cast: string }) => {
    setSelectedReviewTarget(item);
    setReviewModalOpen(true);
  };

  const handleReviewSubmit = (data: any) => {
    console.log("Review Submitted", data);
    // Remove from pending locally
    setPendingReviews((prev) =>
      prev.filter((p) => p.id !== selectedReviewTarget?.id),
    );
    setReviewModalOpen(false);
  };

  return (
    <div className="bg-slate-50 pb-24 md:pb-safe min-h-screen">
      <main className="p-6 space-y-8 pt-4">
        {/* Profile Header */}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 p-0.5 shadow-lg">
            <div className="h-full w-full rounded-full bg-white p-0.5">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt="avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-slate-100 flex items-center justify-center text-2xl">
                  👤
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 rounded-full bg-slate-900 border-2 border-white px-2 py-0.5 text-[10px] font-bold text-white">
              Silver
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold font-serif text-slate-900">
              {user?.name}
            </h2>
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
            {
              label: "Favorites",
              icon: "❤️",
              color: "bg-pink-50 text-pink-600",
              href: "/favorites",
            },
            {
              label: "Following",
              icon: "👥",
              color: "bg-blue-50 text-blue-600",
              href: "/following",
            },
            {
              label: "Footprints",
              icon: "🐾",
              color: "bg-orange-50 text-orange-600",
              href: "/footprints",
            },
            {
              label: "Blocking",
              icon: "⛔",
              color: "bg-slate-50 text-slate-600",
              href: "/blocking",
            },
          ].map((action) => (
            <Link
              href={action.href}
              key={action.label}
              className="flex flex-col items-center gap-2 rounded-xl bg-white p-3 shadow-sm border border-slate-100 transition-transform active:scale-95"
            >
              <div
                className={`h-10 w-10 flex items-center justify-center rounded-full text-lg ${action.color}`}
              >
                {action.icon}
              </div>
              <span className="text-[10px] font-bold text-slate-600">
                {action.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Reliability Score Widget */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-white p-6 shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none grayscale">
            <span className="text-6xl">🛡️</span>
          </div>

          <div className="relative z-10">
            {/* Top Row: Metrics Centered in Halves */}
            <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-slate-100">
              {/* Left: Guest Reliability */}
              <div className="flex flex-col items-center text-center border-r border-slate-100/50">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Guest Reliability
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold font-mono text-amber-500 leading-none">
                    A+
                  </span>
                  <span className="text-base font-medium text-slate-500">
                    Excellent
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Score: 850 / 999
                </div>
              </div>

              {/* Right: Vow Completion */}
              <div className="flex flex-col items-center text-center">
                <div className="text-[9px] uppercase font-bold text-slate-400 mb-0.5">
                  Vow Completion
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-bold font-mono text-slate-800">
                    98<span className="text-lg">%</span>
                  </span>
                </div>
                <span className="text-xs text-slate-400 font-mono block mt-1">
                  (49/50)
                </span>
              </div>
            </div>

            {/* Middle: Radar Chart (Centered & Large) */}
            <div className="flex justify-center -mb-8">
              <GuestRadar
                scores={[90, 85, 95, 80, 100]}
                className="w-[200px] h-[200px]"
              />
            </div>
          </div>

          {/* Bottom: Cast-facing Hint */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <p className="text-xs text-slate-500 italic flex items-center gap-2">
              <span className="text-amber-500">💡</span>
              "Very polite, punctual, and generous."
            </p>
          </div>
        </div>

        {/* Pending Reviews (Active Rituals / Past Due) */}
        <AnimatePresence>
          {pendingReviews.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3 px-1">
                <span className="flex h-2 w-2 rounded-full bg-pink-500 animate-pulse"></span>
                <h3 className="font-bold text-sm text-slate-800">
                  Pending Reviews
                </h3>
              </div>
              <div className="space-y-3">
                {pendingReviews.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center justify-between rounded-xl bg-white p-4 shadow-md border border-pink-100 ring-1 ring-pink-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs overflow-hidden">
                        {/* Mock Avatar */}
                        <img
                          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 text-sm">
                          {item.cast}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold">
                          {item.type}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => openReviewModal(item)}
                      className="px-4 py-2 rounded-full bg-pink-500 text-white text-xs font-bold shadow-md hover:bg-pink-600 transition-transform active:scale-95"
                    >
                      Write Review
                    </button>
                  </motion.div>
                ))}
              </div>
            </section>
          )}
        </AnimatePresence>

        {/* Recent History Preview */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="font-bold text-sm text-slate-800">Recent Pledges</h3>
            <button className="text-xs font-bold text-pink-500">
              View All
            </button>
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
                    <div className="font-bold text-slate-800 text-sm">
                      {item.cast}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {item.date} • {item.type}
                    </div>
                  </div>
                </div>
                <div
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                            ${item.status === "sealed" ? "bg-red-100 text-red-600 border border-red-200" : "bg-slate-100 text-slate-500 border border-slate-200"}
                        `}
                >
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
            "Terms of Service",
          ].map((item, i) => (
            <button
              key={item}
              className={`w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors ${i !== 4 ? "border-b border-slate-50" : ""}`}
            >
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
      <ReviewForm
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        onSubmit={handleReviewSubmit}
        castName={selectedReviewTarget?.cast || "Cast"}
      />
    </div>
  );
};
