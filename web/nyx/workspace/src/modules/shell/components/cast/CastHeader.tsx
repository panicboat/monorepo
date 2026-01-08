"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export const CastHeader = () => {
  const router = useRouter();
  const pathname = usePathname();

  // Simple title logic (can be expanded like Guest TopNavBar)
  const getTitle = () => {
    if (pathname.includes("/manage/onboarding")) return "Cast Onboarding";
    if (pathname.includes("/manage/dashboard")) return "Dashboard";
    return "Cast Manage";
  };

  const handleBack = () => {
    router.back();
  };

  // Only show back button if deep in hierarchy or explicitly needed
  const showBack = pathname.includes("/onboarding");

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md px-4 py-3">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <div className="w-8">
          {showBack && (
            <button
              onClick={handleBack}
              className="text-slate-400 hover:text-slate-600 p-1 -ml-1 rounded-full hover:bg-slate-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="text-sm font-bold text-slate-700">{getTitle()}</div>

        <div className="w-8" /> {/* Spacer for balance */}
      </div>
    </header>
  );
};
