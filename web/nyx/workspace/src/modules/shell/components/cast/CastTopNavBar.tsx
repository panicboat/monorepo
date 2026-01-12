"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopNavBar } from "../TopNavBar";

export const CastTopNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();

  /* MyPage condition removed to show standard header */

  const getTitle = () => {
    if (pathname.includes("/manage/onboarding")) return "Cast Onboarding";
    if (pathname.includes("/manage/profile")) return "Edit Profile";
    if (pathname.includes("/manage/plans")) return "Plan Settings";
    if (pathname.includes("/manage/schedule")) return "Schedule";
    if (pathname.includes("/manage/pledges")) return "Pledge Detail";
    if (pathname.includes("/manage/concierge")) return "Concierge";
    if (pathname.includes("/manage/timeline")) return "Timeline";
    if (pathname.includes("/manage/reviews")) return "Reviews";
    if (pathname.includes("/manage/history")) return "History";
    if (pathname.includes("/manage/mypage")) return "Backstage";
    if (pathname.includes("/manage/home")) return "Nyx. Cast";
    return "Cast Manage";
  };

  const handleBack = () => {
    router.back();
  };

  const showBack =
    pathname.includes("/manage/onboarding") ||
    pathname.includes("/manage/profile") ||
    pathname.includes("/manage/plans") ||
    pathname.includes("/manage/pledges") ||
    pathname.includes("/manage/timeline") ||
    pathname.includes("/manage/reviews") ||
    pathname.includes("/manage/history");
  const title = getTitle();

  const LeftSlot = (
    <>
      <Link
        href="/manage/home"
        className="hidden md:block font-serif text-xl font-bold tracking-tight text-slate-900 mr-8"
      >
        Nyx. Cast
      </Link>
      <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
        <Link
          href="/manage/home"
          className="hover:text-pink-500 transition-colors"
        >
          Home
        </Link>
        <Link
          href="/manage/schedule"
          className="hover:text-pink-500 transition-colors"
        >
          Schedule
        </Link>
        <Link
          href="/manage/timeline"
          className="hover:text-pink-500 transition-colors"
        >
          Timeline
        </Link>
        <Link
          href="/manage/concierge"
          className="hover:text-pink-500 transition-colors"
        >
          Concierge
        </Link>
        <Link
          href="/manage/mypage"
          className="hover:text-pink-500 transition-colors"
        >
          MyPage
        </Link>
      </div>
    </>
  );

  const RightSlot = (
    <Link
      href="/manage/mypage"
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
      rightSlot={RightSlot}
      backIconStyle="chevron"
    />
  );
};
