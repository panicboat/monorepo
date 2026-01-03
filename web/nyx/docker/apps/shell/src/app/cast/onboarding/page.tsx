"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronLeft, MoreVertical } from "lucide-react";
import OnboardingWizard from "@/components/features/cast/OnboardingWizard";
import { useRouter } from "next/navigation";

export default function CastOnboardingPage() {
  const [isWizardOpen, setIsWizardOpen] = useState(true);
  const router = useRouter();

  // In the demo, the app is blurred initially
  const appStateClass = isWizardOpen
    ? "opacity-0 filter blur-sm"
    : "opacity-100 filter blur-0";

  const handleFinish = () => {
    setIsWizardOpen(false);
    // Redirect to dashboard after wizard completion
    setTimeout(() => {
      router.push("/cast/dashboard");
    }, 500);
  };

  return (
    <div className="bg-black text-slate-200 h-screen font-sans flex justify-center overflow-hidden">
      <div className="w-full max-w-md bg-slate-950 h-full relative shadow-2xl overflow-hidden">

        {/* Main App Content - Visible after wizard */}
        <div
          className={`h-full flex flex-col transition-all duration-1000 ${appStateClass}`}
        >
          {/* Header */}
          <header className="h-16 border-b border-slate-800 bg-slate-900/80 flex items-center px-4 justify-between z-10 shrink-0">
            <Link href="/cast/dashboard">
              <ChevronLeft className="text-slate-400 w-6 h-6" />
            </Link>

            <div className="flex flex-col items-center">
              <span className="font-bold text-white text-sm flex items-center gap-1">
                Takuya
              </span>
            </div>

            <button>
              <MoreVertical className="text-slate-400 w-6 h-6" />
            </button>
          </header>

          {/* Chat Content Mock */}
          <main className="flex-1 p-4 bg-slate-900/50">
            <div className="flex gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-blue-900 flex items-center justify-center text-xs font-bold text-white">
                T
              </div>
              <div className="bg-slate-800 p-3 rounded-r-2xl rounded-bl-2xl text-sm max-w-[80%] text-slate-200">
                (Setup completed)
              </div>
            </div>
          </main>
        </div>

        {/* Onboarding Wizard */}
        {isWizardOpen && (
          <OnboardingWizard onFinish={handleFinish} />
        )}
      </div>
    </div>
  );
}
