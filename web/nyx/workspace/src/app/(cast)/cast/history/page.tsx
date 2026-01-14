"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Calendar, Clock, MapPin, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

type HistoryItem = {
  id: string;
  guestName: string;
  plan: string;
  date: string;
  time: string;
  location: string;
  amount: string;
  status: "completed" | "cancelled";
};

const MOCK_HISTORY: HistoryItem[] = [
  {
    id: "1",
    guestName: "Guest_8823",
    plan: "90min VIP Course",
    date: "2026-01-10",
    time: "19:00 - 20:30",
    location: "Club VENUS",
    amount: "¥35,000",
    status: "completed",
  },
  {
    id: "2",
    guestName: "Guest_1102",
    plan: "60min Standard",
    date: "2026-01-05",
    time: "21:00 - 22:00",
    location: "Hotel XYZ",
    amount: "¥20,000",
    status: "completed",
  },
  {
    id: "3",
    guestName: "Guest_5599",
    plan: "120min Special",
    date: "2025-12-28",
    time: "18:00 - 20:00",
    location: "Club VENUS",
    amount: "¥45,000",
    status: "completed",
  },
  {
    id: "4",
    guestName: "Guest_0000",
    plan: "60min Standard",
    date: "2025-12-15",
    time: "20:00 - 21:00",
    location: "Private Lounge",
    amount: "¥20,000",
    status: "cancelled",
  },
];

export default function CastHistoryPage() {
  const [search, setSearch] = useState("");

  const filteredHistory = MOCK_HISTORY.filter((item) =>
    item.guestName.toLowerCase().includes(search.toLowerCase()) ||
    item.plan.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-slate-800">Ritual History</h1>
      </div>

      {/* Search/Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
        <Input
          placeholder="Search by guest or plan..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {filteredHistory.length > 0 ? (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm flex items-center justify-between group hover:border-pink-200 transition-colors cursor-pointer"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Badge
                    variant={item.status === "completed" ? "default" : "secondary"}
                    className={item.status === "cancelled" ? "bg-slate-100 text-slate-500" : "bg-green-100 text-green-700 hover:bg-green-200"}
                  >
                    {item.status.toUpperCase()}
                  </Badge>
                  <span className="font-bold text-slate-900">{item.guestName}</span>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-sm text-slate-700">{item.plan}</p>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Calendar size={12} />
                      {item.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={12} />
                      {item.time}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin size={12} />
                  {item.location}
                </div>
              </div>

              <div className="text-right">
                <p className="font-bold text-slate-900">{item.amount}</p>
                <ChevronRight className="ml-auto mt-2 text-slate-300 group-hover:text-pink-400 transition-colors" />
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-10 text-slate-400">
            No history found.
          </div>
        )}
      </div>
    </div>
  );
}
