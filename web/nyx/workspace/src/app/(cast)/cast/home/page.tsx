"use client";

import { useEffect, useState } from "react";
import { EarningsSummary } from "./components/EarningsSummary";
import { UpcomingReservations } from "./components/UpcomingReservations";
import { useAuthStore } from "@/stores/authStore";

interface DashboardStats {
  earningsToday: number;
  earningsTodayChange: number;
  earningsThisWeek: number;
  earningsThisMonth: number;
  reservationsThisMonth: number;
  promiseRate: number;
  followers: number;
}

interface Reservation {
  id: string;
  guestName: string;
  date: string;
  startTime: string;
  planName: string;
  status: string;
  duration: number;
  guestIcon: string;
}

export default function CastDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const token = useAuthStore.getState().accessToken;
      if (!token) {
        window.location.href = "/cast/login";
        return;
      }

      const authHeaders = {
        "Authorization": `Bearer ${token}`,
      };

      try {
        // 1. Check Onboarding Status via visibility
        const profileRes = await fetch("/api/cast/onboarding/profile", {
          cache: "no-store",
          headers: authHeaders,
        });
        if (!profileRes.ok) {
           if (profileRes.status === 404) {
             // No profile -> Step 1
             window.location.href = "/cast/onboarding/step-1";
             return;
           }
        }

        const profileData = await profileRes.json();
        const { profile } = profileData;

        if (!profile) {
             window.location.href = "/cast/onboarding/step-1";
             return;
        }

        // Check visibility: UNREGISTERED means onboarding not complete
        // visibility values: "unregistered", "unpublished", "published"
        if (!profile.visibility || profile.visibility === "CAST_VISIBILITY_UNREGISTERED") {
            window.location.href = "/cast/onboarding/step-1";
            return;
        }

        // If visibility is UNPUBLISHED or PUBLISHED, user can access home
        // Fetch dashboard data
        const [statsRes, reservationsRes] = await Promise.all([
          fetch("/api/cast/stats", { headers: authHeaders }),
          fetch("/api/cast/upcoming-reservations", { headers: authHeaders }),
        ]);

        if (statsRes.ok && reservationsRes.ok) {
          const statsData = await statsRes.json();
          const reservationsData = await reservationsRes.json();
          setStats(statsData);
          setReservations(reservationsData.reservations);
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[50vh]">
        <div className="animate-pulse flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="h-32 w-full bg-slate-200 rounded-xl"></div>
          <div className="h-48 w-full bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 pb-24">
      {stats && <EarningsSummary stats={stats} />}

      <UpcomingReservations reservations={reservations} />
    </div>
  );
}
