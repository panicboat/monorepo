"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export const OnboardingHeader = () => {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur-md px-4 py-3">
      <div className="mx-auto flex max-w-md items-center justify-between">
        <button
          onClick={handleBack}
          className="text-slate-400 hover:text-slate-600 p-1 -ml-1 rounded-full hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-sm font-bold text-slate-700">Cast Onboarding</div>
        <div className="w-5" /> {/* Spacer for balance */}
      </div>
    </header>
  );
};
