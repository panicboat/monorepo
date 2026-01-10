"use client";

import { useEffect, useState } from "react";
import { EarningsSummary } from "./components/EarningsSummary";
import { UpcomingReservations } from "./components/UpcomingReservations";
import { StatusToggle } from "@/modules/shell/components/cast/StatusToggle";

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
      try {
        const [statsRes, reservationsRes] = await Promise.all([
          fetch("/api/cast/stats"),
          fetch("/api/cast/upcoming-reservations"),
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
      <div className="flex items-center justify-between">
        <StatusToggle />
        <span className="text-xs text-slate-400 font-medium">
          Updated just now
        </span>
      </div>

      {stats && <EarningsSummary stats={stats} />}

      <UpcomingReservations reservations={reservations} />
    </div>
  );
}
