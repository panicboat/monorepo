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
    if (pathname.includes("/cast/timeline")) return "Timeline";
    if (pathname.includes("/cast/followers")) return "Followers";
    if (pathname.includes("/cast/mypage")) return "Backstage";
    if (pathname.includes("/cast/home")) return "Nyx. Cast";
    return "Cast Manage";
  };

  const title = getTitle();

  const LeftSlot = (
    <Link
      href="/cast/home"
      className="hidden md:block font-serif text-xl font-bold tracking-tight text-text-primary"
    >
      Nyx. Cast
    </Link>
  );

  const isActive = (path: string) => pathname.includes(path);

  const linkClass = (path: string) =>
    isActive(path)
      ? "text-role-cast font-bold"
      : "text-text-secondary hover:text-role-cast transition-colors";

  const RightSlot = (
    <>
      {/* Desktop Nav Links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium mr-4" aria-label="Cast navigation">
        <Link href="/cast/home" aria-current={isActive("/cast/home") ? "page" : undefined} className={linkClass("/cast/home")}>
          Home
        </Link>
        <Link href="/cast/timeline" aria-current={isActive("/cast/timeline") ? "page" : undefined} className={linkClass("/cast/timeline")}>
          Timeline
        </Link>
      </nav>

      {/* Cast Avatar */}
      <Link
        href="/cast/mypage"
        aria-label="Backstage"
        className="h-8 w-8 rounded-full bg-surface-secondary overflow-hidden border border-border block transition-transform hover:scale-105 active:scale-95"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Cast avatar" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden="true" className="flex h-full w-full items-center justify-center text-sm">👤</span>
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
