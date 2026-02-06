"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";
import { GuestRadar } from "./GuestRadar";
import { ReviewForm } from "@/modules/trust/components/guest/ReviewForm";

export const GuestDashboard = () => {
  const { user, logout } = useAuth();
  const { profile, avatarUrl, hasProfile } = useGuestData();

  // Review Modal State
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedReviewTarget, setSelectedReviewTarget] = useState<{
    id: number;
    cast: string;
  } | null>(null);

  // Mock Data
  // TODO: Fetch pending reviews from Trust Service (or Portfolio)
  const [pendingReviews, setPendingReviews] = useState([
    {
      id: 101,
      cast: "Yuna",
      date: "Today 21:00",
      type: "Standard 60min",
      isPastDue: true,
    },
  ]);

  // TODO: Fetch history from Ritual Service
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
    <div className="bg-surface-secondary pb-24 md:pb-safe min-h-screen">
      <main className="p-6 space-y-8 pt-4">
        {/* Profile Header */}
        <Link href="/mypage/profile" className="flex items-center gap-4 group">
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-role-guest-light to-role-guest p-0.5 shadow-lg group-hover:shadow-xl transition-shadow">
            <div className="h-full w-full rounded-full bg-surface p-0.5">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="h-full w-full rounded-full bg-surface-secondary flex items-center justify-center text-2xl">
                  👤
                </div>
              )}
            </div>
            <div className="absolute bottom-0 right-0 rounded-full bg-neutral-900 border-2 border-white px-2 py-0.5 text-[10px] font-bold text-white">
              Silver
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold font-serif text-text-primary">
                {hasProfile ? profile.name : user?.name || "ゲスト"}
              </h2>
              <span className="text-text-muted group-hover:text-info transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </span>
            </div>
            <p className="text-xs text-text-secondary font-mono">ID: {user?.id?.slice(0, 8) || "--------"}</p>
          </div>
        </Link>

        {/* Quick Actions */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {
              label: "Favorites",
              icon: "❤️",
              color: "bg-info-lighter text-info",
              href: "/favorites",
            },
            {
              label: "Following",
              icon: "👥",
              color: "bg-info-lighter text-info",
              href: "/following",
            },
            {
              label: "Footprints",
              icon: "🐾",
              color: "bg-warning-lighter text-warning",
              href: "/footprints",
            },
            {
              label: "Blocking",
              icon: "⛔",
              color: "bg-surface-secondary text-text-secondary",
              href: "/blocking",
            },
          ].map((action) => (
            <Link
              href={action.href}
              key={action.label}
              className="flex flex-col items-center gap-2 rounded-xl bg-surface p-3 shadow-sm border border-border transition-transform active:scale-95"
            >
              <div
                className={`h-10 w-10 flex items-center justify-center rounded-full text-lg ${action.color}`}
              >
                {action.icon}
              </div>
              <span className="text-[10px] font-bold text-text-secondary">
                {action.label}
              </span>
            </Link>
          ))}
        </div>

        {/* Reliability Score Widget */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-50/80 via-white to-white p-6 shadow-sm border border-border relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none grayscale">
            <span className="text-6xl">🛡️</span>
          </div>

          <div className="relative z-10">
            {/* Top Row: Metrics Centered in Halves */}
            <div className="grid grid-cols-2 gap-4 pb-4 mb-4 border-b border-border">
              {/* Left: Guest Reliability */}
              <div className="flex flex-col items-center text-center border-r border-border/50">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">
                  Guest Reliability
                </h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold font-mono text-amber-500 leading-none">
                    A+
                  </span>
                  <span className="text-base font-medium text-text-secondary">
                    Excellent
                  </span>
                </div>
                <div className="text-[10px] text-text-muted font-mono mt-1">
                  {/* TODO: Fetch real Reliability Score from Trust Service */}
                  Score: 850 / 999
                </div>
              </div>

              {/* Right: Vow Completion */}
              <div className="flex flex-col items-center text-center">
                <div className="text-[9px] uppercase font-bold text-text-muted mb-0.5">
                  Vow Completion
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-5xl font-bold font-mono text-text-primary">
                    98<span className="text-lg">%</span>
                  </span>
                </div>
                <span className="text-xs text-text-muted font-mono block mt-1">
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
          <div className="mt-4 pt-3 border-t border-border">
            <p className="text-xs text-text-secondary italic flex items-center gap-2">
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
                <span className="flex h-2 w-2 rounded-full bg-info animate-pulse"></span>
                <h3 className="font-bold text-sm text-text-primary">
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
                    className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-md border border-info-light ring-1 ring-info-lighter"
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 rounded-full bg-surface-secondary flex-shrink-0 flex items-center justify-center text-xs overflow-hidden">
                        {/* Mock Avatar */}
                        <img
                          src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"
                          alt="avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="font-bold text-text-primary text-sm">
                          {item.cast}
                        </div>
                        <div className="text-[10px] text-text-secondary font-bold">
                          {item.type}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => openReviewModal(item)}
                      className="px-4 py-2 rounded-full bg-info text-white text-xs font-bold shadow-md hover:bg-info-hover transition-transform active:scale-95"
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
            <h3 className="font-bold text-sm text-text-primary">Recent Pledges</h3>
            <button className="text-xs font-bold text-info">
              View All
            </button>
          </div>
          <div className="space-y-3">
            {history.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-xl bg-surface p-4 shadow-sm border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-surface-secondary flex-shrink-0 flex items-center justify-center text-xs">
                    {/* Placeholder Avatar */}
                    👩
                  </div>
                  <div>
                    <div className="font-bold text-text-primary text-sm">
                      {item.cast}
                    </div>
                    <div className="text-[10px] text-text-muted">
                      {item.date} • {item.type}
                    </div>
                  </div>
                </div>
                <div
                  className={`px-2 py-1 rounded text-[10px] font-bold uppercase
                            ${item.status === "sealed" ? "bg-error-light text-error border border-error-light" : "bg-surface-secondary text-text-secondary border border-border"}
                        `}
                >
                  {item.status}
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Menu List */}
        <div className="rounded-2xl bg-surface shadow-sm border border-border overflow-hidden">
          {[
            { label: "Profile Settings", href: "/mypage/profile" },
            { label: "Account Settings", href: "#" },
            { label: "Notification Settings", href: "#" },
            { label: "Payment Methods", href: "#" },
            { label: "Help & Support", href: "#" },
            { label: "Terms of Service", href: "#" },
          ].map((item, i, arr) => (
            <Link
              key={item.label}
              href={item.href}
              className={`w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors ${i !== arr.length - 1 ? "border-b border-border" : ""}`}
            >
              <span>{item.label}</span>
              <span className="text-text-muted">›</span>
            </Link>
          ))}
        </div>

        <button
          onClick={logout}
          className="w-full rounded-xl bg-surface-secondary py-3 text-sm font-bold text-text-secondary hover:bg-neutral-200 hover:text-text-secondary transition-colors"
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
