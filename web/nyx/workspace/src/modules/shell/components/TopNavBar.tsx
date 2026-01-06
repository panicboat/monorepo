"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "../../identity/hooks/useAuth";

export const TopNavBar = () => {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Ensure shell is always visible (loading state handled nicely)
  // if (isLoading || !user) return null;

  // Determine Title & Back Button availability based on path
  let title = "Nyx.";
  let showBack = false;

  if (pathname === "/") {
    title = "Nyx.";
    showBack = false;
  } else if (pathname === "/concierge") {
    title = "Concierge";
    showBack = false;
  } else if (pathname === "/search") {
    title = "Search";
    showBack = false;
  } else if (pathname === "/mypage") {
    title = "My Page";
    showBack = false;
  } else if (pathname === "/favorites") {
    title = "Favorites";
    showBack = true;
  } else if (pathname === "/following") {
    title = "Following";
    showBack = true;
  } else if (pathname === "/footprints") {
    title = "Footprints";
    showBack = true;
  } else if (pathname === "/blocking") {
    title = "Blocking";
    showBack = true;
  } else if (pathname.startsWith("/cast/")) {
    title = "Cast Profile";
    showBack = true;
  } else if (pathname.startsWith("/concierge/")) {
    title = "Chat Room";
    showBack = true;
  } else if (pathname.startsWith("/timeline/")) {
    title = "Timeline";
    showBack = true;
  }

  const handleBack = () => {
    router.back();
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-14 md:h-16 w-full items-center justify-center bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-100">
      <div className="w-full max-w-md md:max-w-7xl px-4 flex items-center justify-between">

        {/* LEFT: Back Button (Mobile/Desktop Subpage) or Logo (Desktop Home) */}
        <div className="flex items-center gap-4">
          {/* Logo - Desktop Only */}
          <Link href="/" className="hidden md:block font-serif text-2xl font-bold tracking-tight text-slate-900 mr-4">
            Nyx.
          </Link>

          {/* Desktop Nav Links - Only on Root/Tabs? Or Always? Always good for Global Nav */}
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
            <Link href="/" className="hover:text-pink-500 transition-colors">Home</Link>
            <Link href="/search" className="hover:text-pink-500 transition-colors">Search</Link>
            <Link href="/concierge" className="hover:text-pink-500 transition-colors">Concierge</Link>
          </div>

          {/* Mobile: Back Button or Search Icon */}
          <div className="md:hidden">
            {showBack ? (
              <button
                onClick={handleBack}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
              >
                <ChevronLeft size={20} />
              </button>
            ) : pathname === "/" ? (
              <Link href="/search" className="rounded-full bg-slate-100 p-2 text-slate-600 block">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
              </Link>
            ) : <div className="w-8"></div>}
          </div>

          {/* Desktop Separator if Subpage */}
          {showBack && <div className="hidden md:block h-6 w-px bg-slate-200 mx-2"></div>}

          {/* Desktop Subpage Title */}
          {showBack && (
            <div className="hidden md:flex items-center gap-2">
              <button onClick={handleBack} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="font-bold text-slate-900">{title}</span>
            </div>
          )}
        </div>

        {/* CENTER: Mobile Title */}
        <span className="md:hidden font-serif text-lg font-bold tracking-tight text-slate-900 absolute left-1/2 -translate-x-1/2">
          {title}
        </span>

        {/* RIGHT: User Profile / Icons */}
        <div className="flex items-center gap-3">
          <Link href="/mypage" className="h-8 w-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 block transition-transform hover:scale-105 active:scale-95">
            {user?.avatarUrl ? <img src={user.avatarUrl} alt="User" /> : "👤"}
          </Link>
        </div>
      </div>
    </header>
  );
};
