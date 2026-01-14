"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/modules/identity/hooks/useAuth";

const RECOMMENDED_CASTS = [
  {
    id: 101,
    name: "Mio",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mio",
    tag: "New",
  },
  {
    id: 102,
    name: "Rin",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin",
    tag: "Popular",
  },
  {
    id: 103,
    name: "Kila",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila",
    tag: "Online",
  },
];

export const GuestDesktopSidebars = () => {
  const { user, isLoading } = useAuth();

  if (isLoading || !user) return null;

  return (
    <aside className="hidden w-80 flex-col gap-6 pt-24 lg:flex sticky top-0 h-screen overflow-y-auto no-scrollbar">
      {/* Recommends Widget */}
      <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-bold text-slate-800">Tonight's Picks</h3>
        <div className="space-y-4">
          {RECOMMENDED_CASTS.map((cast) => (
            <Link
              href={`/casts/${cast.id}`}
              key={cast.id}
              className="flex items-center gap-4 group"
            >
              <div className="relative h-12 w-12 overflow-hidden rounded-full border border-slate-100 transition-transform group-hover:scale-105">
                <img
                  src={cast.image}
                  alt={cast.name}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 group-hover:text-pink-500 transition-colors">
                    {cast.name}
                  </h4>
                  <span className="text-[10px] bg-pink-50 text-pink-600 px-2 py-0.5 rounded-full font-bold">
                    {cast.tag}
                  </span>
                </div>
                <p className="text-xs text-slate-400">Available from 20:00</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Banner / Ad Area */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white shadow-md">
        <h3 className="mb-2 font-bold text-lg">First Time?</h3>
        <p className="text-sm opacity-90 mb-4">
          Check our beginner's guide to the Ritual.
        </p>
        <button className="w-full rounded-lg bg-white/20 py-2 text-sm font-bold backdrop-blur-sm transition-colors hover:bg-white/30">
          Read Guide
        </button>
      </div>
    </aside>
  );
};
