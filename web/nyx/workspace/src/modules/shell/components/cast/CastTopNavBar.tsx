"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopNavBar } from "../TopNavBar";

export const CastTopNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const getTitle = () => {
    if (pathname.includes("/manage/onboarding")) return "Cast Onboarding";
    if (pathname.includes("/manage/profile")) return "Edit Profile";
    if (pathname.includes("/manage/schedule")) return "Schedule";
    if (pathname.includes("/manage/reservations")) return "Reservation Detail";
    if (pathname.includes("/manage/dashboard")) return "Nyx. Cast";
    return "Cast Manage";
  };

  const handleBack = () => {
    router.back();
  };

  const showBack =
    pathname.includes("/onboarding") ||
    pathname.includes("/manage/profile") ||
    pathname.includes("/manage/reservations");
  const title = getTitle();

  const LeftSlot = (
    <>
      <Link
        href="/manage/dashboard"
        className="hidden md:block font-serif text-xl font-bold tracking-tight text-slate-900 mr-8"
      >
        Nyx. Cast
      </Link>
      <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-500">
        <Link
          href="/manage/dashboard"
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
          href="/manage/inbox"
          className="hover:text-pink-500 transition-colors"
        >
          Inbox
        </Link>
        <Link
          href="/manage/plans"
          className="hover:text-pink-500 transition-colors"
        >
          Plan
        </Link>
      </div>
    </>
  );

  const RightSlot = (
    <Link
      href="/manage/profile"
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
