"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { TopNavBar } from "../TopNavBar";

export const GuestTopNavBar = () => {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

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

  const LeftSlot = (
    <>
      <Link href="/" className="hidden md:block font-serif text-2xl font-bold tracking-tight text-slate-900 mr-4">
        Nyx.
      </Link>

      {/* Desktop Nav Links */}
      <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
        <Link href="/" className="hover:text-pink-500 transition-colors">Home</Link>
        <Link href="/search" className="hover:text-pink-500 transition-colors">Search</Link>
        <Link href="/concierge" className="hover:text-pink-500 transition-colors">Concierge</Link>
      </div>

      {/* Guest Specific: Mobile Home Search Icon if no back button */}
      {!showBack && pathname === "/" && (
        <div className="md:hidden">
          <Link href="/search" className="rounded-full bg-slate-100 p-2 text-slate-600 block">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          </Link>
        </div>
      )}
    </>
  );

  const RightSlot = (
    <Link href="/mypage" className="h-8 w-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 block transition-transform hover:scale-105 active:scale-95">
      {user?.avatarUrl ? <img src={user.avatarUrl} alt="User" /> : "👤"}
    </Link>
  );

  return (
    <TopNavBar
      title={title}
      showBack={showBack}
      onBack={handleBack}
      leftSlot={LeftSlot}
      rightSlot={RightSlot}
      backIconStyle="chevron"
    />
  );
};
