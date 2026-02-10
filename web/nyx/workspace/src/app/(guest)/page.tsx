"use client";

import { useAuth } from "@/modules/identity/hooks/useAuth";
import { GuestDashboard } from "@/modules/portfolio/components/guest/GuestDashboard";
import { TimelineFeed } from "@/modules/social/components/guest/TimelineFeed";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [view, setView] = useState<"home" | "mypage">("home");

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
      <div className="flex h-screen items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-role-guest"></div>
      </div>
    );

  return (
    <main className="pb-20">
      {view === "home" ? (
        <div className="bg-surface-secondary">
          <TimelineFeed onItemClick={(id) => router.push(`/timeline/${id}`)} />
        </div>
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
