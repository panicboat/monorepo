"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopNavBar } from "../TopNavBar";

export const CastTopNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();

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
    pathname.includes("/cast/reviews") ||
    pathname.includes("/cast/history");
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
    <div className="hidden md:flex items-center gap-6 text-sm font-medium">
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
      <Link href="/cast/mypage" className={linkClass("/cast/mypage")}>
        MyPage
      </Link>
    </div>
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
