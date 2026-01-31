"use client";

import { CastList } from "@/modules/portfolio/components/guest/CastList";
import { useAuth } from "@/modules/identity/hooks/useAuth";
import { GuestDashboard } from "@/modules/portfolio/components/guest/GuestDashboard";
import { RankingWidget } from "@/modules/portfolio/components/guest/RankingWidget";
import { EventSlider } from "@/modules/portfolio/components/guest/EventSlider";
import { TimelineFeed } from "@/modules/social/components/guest/TimelineFeed";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"home" | "mypage">("home");
  const [tab, setTab] = useState<"cast" | "timeline">("timeline");

  useEffect(() => {
    if (!isLoading && !user) {
      console.log("GuestPage Redirecting: isLoading=", isLoading, "user=", user);
      router.push("/login");
    } else {
      console.log("GuestPage Stay: isLoading=", isLoading, "user=", user);
    }
  }, [isLoading, user, router]);

  if (isLoading || !user)
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-400"></div>
      </div>
    );

  return (
    <main className="pb-20">
      {view === "home" ? (
        <>
          {/* Header removed in favor of global MobileHeader */}

          <div className="space-y-2">
            {/* Discovery Widgets */}
            <EventSlider />

            <section className="bg-white py-2 shadow-sm">
              <RankingWidget />
            </section>

            {/* Tab Navigation */}
            <div className="sticky top-14 md:top-16 z-20 flex border-b border-slate-200 bg-white shadow-sm">
              <button
                onClick={() => setTab("timeline")}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "timeline" ? "border-b-2 border-blue-400 text-blue-400" : "text-slate-400"}`}
              >
                Timeline
              </button>
              <button
                onClick={() => setTab("cast")}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === "cast" ? "border-b-2 border-blue-400 text-blue-400" : "text-slate-400"}`}
              >
                Cast List
              </button>
            </div>

            {/* Content Area */}
            <div className="bg-slate-50">
              {tab === "timeline" ? (
                <TimelineFeed />
              ) : (
                <div className="px-1 py-2">
                  <CastList />
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div>
          <button
            onClick={() => setView("home")}
            className="fixed top-4 left-4 z-50 rounded-full bg-black/50 p-2 text-white backdrop-blur-md"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <GuestDashboard />
        </div>
      )}
    </main>
  );
}
