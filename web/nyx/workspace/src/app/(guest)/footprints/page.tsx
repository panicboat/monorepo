"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const FOOTPRINTS = [
  {
    id: 8,
    name: "Aoi",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aoi",
    time: "10 min ago",
  },
  {
    id: 1,
    name: "Yuna",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    time: "2 hours ago",
  },
  {
    id: 9,
    name: "Nana",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nana",
    time: "Yesterday",
  },
  {
    id: 10,
    name: "Luna",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
    time: "Yesterday",
  },
];

export default function FootprintsPage() {
  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <main className="px-4 pt-4">
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          {FOOTPRINTS.map((cast, i) => (
            <motion.div
              key={cast.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-4 border-b border-slate-50 last:border-0 p-4 hover:bg-slate-50"
            >
              <Link
                href={`/cast/${cast.id}`}
                className="block h-10 w-10 flex-shrink-0 rounded-full bg-slate-100 overflow-hidden"
              >
                <img
                  src={cast.image}
                  alt={cast.name}
                  className="h-full w-full object-cover"
                />
              </Link>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-bold text-slate-800">{cast.name}</span>
                  <span className="text-slate-500"> visited your profile.</span>
                </p>
                <p className="text-[10px] text-slate-400">{cast.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </div>
  );
}
