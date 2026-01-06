"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useAuth } from "../../identity/hooks/useAuth";

export const MobileHeader = () => {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Hide if loading or not logged in (LoginGate handles its own UI)
  if (isLoading || !user) return null;

  // Determine Title & Back Button availability based on path
  let title = "Nyx.";
  let showBack = false;

  if (pathname === "/") {
    title = "Nyx.";
    showBack = false;
  } else if (pathname === "/concierge") {
    title = "Concierge";
    showBack = false; // Top level tab
  } else if (pathname === "/search") {
    title = "Search";
    showBack = false; // Top level tab
  } else if (pathname === "/mypage") {
    title = "My Page";
    showBack = false; // Top level tab
  } else if (pathname.startsWith("/cast/")) {
    title = "Cast Profile"; // Ideally dynamic, but "Cast Profile" is safe for global component
    showBack = true;
  } else if (pathname.startsWith("/concierge/")) {
    title = "Chat Room";
    showBack = true;
  }

  // Handle Back
  const handleBack = () => {
    router.back();
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between bg-white/80 px-4 backdrop-blur-md shadow-sm md:hidden">
      <div className="flex items-center gap-3">
        {showBack ? (
          <button
            onClick={handleBack}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
          >
            <ChevronLeft size={20} />
          </button>
        ) : (
          // Search Icon placeholder for Home, or empty for others
          pathname === "/" ? (
            <Link href="/search" className="rounded-full bg-slate-100 p-2 text-slate-600 block">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
            </Link>
          ) : <div className="w-8"></div> // Spacer
        )}
      </div>

      <span className="font-serif text-lg font-bold tracking-tight text-slate-900 absolute left-1/2 -translate-x-1/2">
        {title}
      </span>

      <div className="flex items-center gap-3 w-8 justify-end">
        {/* User Icon on Home/Top levels, maybe share button on details? Keep simple for now */}
        {pathname === "/" ? (
          <Link href="/mypage" className="h-8 w-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 block">
            {user.avatarUrl ? <img src={user.avatarUrl} alt="User" /> : "👤"}
          </Link>
        ) : (
          <div className="w-8"></div> // Spacer
        )}
      </div>
    </header>
  );
};
