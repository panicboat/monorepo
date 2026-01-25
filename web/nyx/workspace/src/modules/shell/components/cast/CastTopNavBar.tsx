"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopNavBar } from "../TopNavBar";

export const CastTopNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();

  /* MyPage condition removed to show standard header */

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

  const handleBack = () => {
    router.back();
  };

  const showBack =
    pathname.includes("/cast/onboarding") ||
    pathname.includes("/cast/profile") ||
    pathname.includes("/cast/plans") ||
    pathname.includes("/cast/pledges") ||
    pathname.includes("/cast/timeline") ||
    pathname.includes("/cast/reviews") ||
    pathname.includes("/cast/history");
  const title = getTitle();

  const LeftSlot = (
    <>
      <Link
        href="/cast/home"
        className="hidden md:block font-serif text-xl font-bold tracking-tight text-slate-900 mr-8"
      >
        Nyx. Cast
      </Link>
      <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
        <Link
          href="/cast/home"
          className="hover:text-pink-500 transition-colors"
        >
          Home
        </Link>
        <Link
          href="/cast/schedules"
          className="hover:text-pink-500 transition-colors"
        >
          Schedule
        </Link>
        <Link
          href="/cast/timeline"
          className="hover:text-pink-500 transition-colors"
        >
          Timeline
        </Link>
        <Link
          href="/cast/concierge"
          className="hover:text-pink-500 transition-colors"
        >
          Concierge
        </Link>
        <Link
          href="/cast/mypage"
          className="hover:text-pink-500 transition-colors"
        >
          MyPage
        </Link>
      </div>
    </>
  );

  const RightSlot = (
    <Link
      href="/cast/mypage"
      className="block h-8 w-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 transition-transform hover:scale-105 active:scale-95"
    >
      <img
        src="https://placehold.co/100x100/pink/white?text=Cast"
        alt="Profile"
        className="h-full w-full object-cover"
      />
    </Link>
  );

  return (
    <TopNavBar
      title={title}
      showBack={showBack}
      onBack={handleBack}
      leftSlot={LeftSlot}
      rightSlot={(
        <Link
          href="/cast/mypage"
          className="block h-8 w-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 transition-transform hover:scale-105 active:scale-95"
        >
          <img
            src="https://placehold.co/100x100/pink/white?text=Cast"
            alt="Profile"
            className="h-full w-full object-cover"
          />
        </Link>
      )}
      backIconStyle="chevron"
    />
  );
};
