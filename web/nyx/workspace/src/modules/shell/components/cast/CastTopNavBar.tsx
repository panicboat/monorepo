"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TopNavBar } from "../TopNavBar";

export const CastTopNavBar = () => {
  const router = useRouter();
  const pathname = usePathname();

  const getTitle = () => {
    if (pathname.includes("/manage/onboarding")) return "Cast Onboarding";
    if (pathname.includes("/manage")) return "Dashboard";
    return "Cast Manage";
  };

  const handleBack = () => {
    router.back();
  };

  const showBack = pathname.includes("/onboarding");
  const title = getTitle();

  const LeftSlot = (
    <Link href="/manage" className="hidden md:block font-serif text-xl font-bold tracking-tight text-slate-900 mr-4">
      Nyx. Cast
    </Link>
  );

  const RightSlot = (
    <div className="h-8 w-8 rounded-full bg-slate-100 overflow-hidden border border-slate-200 block">
      <span className="flex h-full w-full items-center justify-center text-xs text-slate-500 font-bold">Cast</span>
    </div>
  );

  return (
    <TopNavBar
      title={title}
      showBack={showBack}
      onBack={handleBack}
      leftSlot={LeftSlot}
      rightSlot={RightSlot}
      backIconStyle="arrow"
    />
  );
};
