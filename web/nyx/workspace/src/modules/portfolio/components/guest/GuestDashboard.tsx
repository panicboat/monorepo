"use client";

import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";

export const GuestDashboard = () => {
  const { user, logout } = useAuth();
  const { profile, avatarUrl, hasProfile } = useGuestData();

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
        <div className="grid grid-cols-3 gap-3">
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

        {/* Menu List */}
        <div className="rounded-2xl bg-surface shadow-sm border border-border overflow-hidden">
          <Link
            href="/mypage/profile"
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
          >
            <span>Profile Settings</span>
            <span className="text-text-muted">›</span>
          </Link>
        </div>

        <button
          onClick={logout}
          className="w-full rounded-xl bg-surface-secondary py-3 text-sm font-bold text-text-secondary hover:bg-neutral-200 hover:text-text-secondary transition-colors"
        >
          Sign Out
        </button>
      </main>
    </div>
  );
};
