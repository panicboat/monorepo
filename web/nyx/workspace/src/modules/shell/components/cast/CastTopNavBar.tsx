"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCastProfile } from "@/modules/portfolio/hooks/useCastProfile";
import { TopNavBar } from "../TopNavBar";

export const CastTopNavBar = () => {
  const { rawData } = useCastProfile();
  const pathname = usePathname();
  const avatarUrl = rawData?.profile?.avatarUrl || rawData?.profile?.imageUrl;

  const getTitle = () => {
    if (pathname.includes("/cast/onboarding")) return "Cast Onboarding";
    if (pathname.includes("/cast/profile")) return "Edit Profile";
    if (pathname.includes("/cast/plans")) return "Plan Settings";
    if (pathname.includes("/cast/schedules")) return "Schedule";
    if (pathname.includes("/cast/pledges")) return "Pledge Detail";
    if (pathname.includes("/cast/concierge")) return "Concierge";
    if (pathname.includes("/cast/timeline")) return "Timeline";
    if (pathname.includes("/cast/reviews")) return "Reviews";
    if (pathname.includes("/cast/history")) return "History";
    if (pathname.includes("/cast/mypage")) return "Backstage";
    if (pathname.includes("/cast/home")) return "Nyx. Cast";
    return "Cast Manage";
  };

  const title = getTitle();

  const LeftSlot = (
    <Link
      href="/cast/home"
      className="hidden md:block font-serif text-xl font-bold tracking-tight text-slate-900"
    >
      Nyx. Cast
    </Link>
  );

  const isActive = (path: string) => pathname.includes(path);

  const linkClass = (path: string) =>
    isActive(path)
      ? "text-pink-500 font-bold"
      : "text-slate-500 hover:text-pink-500 transition-colors";

  const RightSlot = (
    <>
      {/* Desktop Nav Links */}
      <div className="hidden md:flex items-center gap-6 text-sm font-medium mr-4">
        <Link href="/cast/home" className={linkClass("/cast/home")}>
          Home
        </Link>
        <Link href="/cast/schedules" className={linkClass("/cast/schedules")}>
          Schedule
        </Link>
        <Link href="/cast/timeline" className={linkClass("/cast/timeline")}>
          Timeline
        </Link>
        <Link href="/cast/concierge" className={linkClass("/cast/concierge")}>
          Concierge
        </Link>
      </div>

      {/* Cast Avatar */}
      <Link
        href="/cast/mypage"
        className="h-8 w-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 block transition-transform hover:scale-105 active:scale-95"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Cast" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm">👤</span>
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
