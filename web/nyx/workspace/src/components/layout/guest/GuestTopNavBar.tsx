"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGuestData } from "@/modules/portfolio/hooks/useGuestData";
import { TopNavBar } from "../TopNavBar";

export const GuestTopNavBar = () => {
  const { avatarUrl } = useGuestData();
  const pathname = usePathname();

  // Determine Title based on path
  let title = "Nyx.";

  if (pathname === "/") {
    title = "Nyx.";
  } else if (pathname === "/concierge") {
    title = "Concierge";
  } else if (pathname === "/search") {
    title = "Search";
  } else if (pathname === "/mypage") {
    title = "My Page";
  } else if (pathname === "/favorites") {
    title = "Favorites";
  } else if (pathname === "/following") {
    title = "Following";
  } else if (pathname.startsWith("/cast/")) {
    title = "Cast Profile";
  } else if (pathname.startsWith("/concierge/")) {
    title = "Chat Room";
  } else if (pathname.startsWith("/timeline/")) {
    title = "Timeline";
  }

  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  const linkClass = (path: string) =>
    isActive(path)
      ? "text-role-guest font-bold"
      : "text-text-secondary hover:text-role-guest transition-colors";

  const LeftSlot = (
    <Link
      href="/"
      className="hidden md:block font-serif text-2xl font-bold tracking-tight text-text-primary"
    >
      Nyx.Place
    </Link>
  );

  const RightSlot = (
    <>
      {/* Desktop Nav Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium mr-4" aria-label="Main navigation">
        <Link href="/" aria-current={isActive("/") ? "page" : undefined} className={linkClass("/")}>
          Home
        </Link>
        <Link href="/search" aria-current={isActive("/search") ? "page" : undefined} className={linkClass("/search")}>
          Search
        </Link>
        <Link href="/concierge" aria-current={isActive("/concierge") ? "page" : undefined} className={linkClass("/concierge")}>
          Concierge
        </Link>
      </nav>

      {/* Guest Specific: Mobile Home Search Icon */}
      {pathname === "/" && (
        <div className="md:hidden mr-2">
          <Link
            href="/search"
            aria-label="Search"
            className="rounded-full bg-surface-secondary p-2 text-text-secondary block"
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </Link>
        </div>
      )}

      {/* User Avatar */}
      <Link
        href="/mypage"
        aria-label="My page"
        className="h-8 w-8 rounded-full bg-surface-secondary overflow-hidden border border-border block transition-transform hover:scale-105 active:scale-95 flex items-center justify-center"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="User avatar" className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm">👤</span>
        )}
      </Link>
    </>
  );

  return (
    <TopNavBar
      title={title}
      leftSlot={LeftSlot}
      rightSlot={RightSlot}
    />
  );
};
