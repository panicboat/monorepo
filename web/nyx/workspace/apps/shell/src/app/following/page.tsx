"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

const FOLLOWING = [
  { id: 2, name: "Maria", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria", area: "Roppongi" },
  { id: 3, name: "Sarah", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", area: "Shibuya" },
  { id: 5, name: "Rin", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin", area: "Ginza" },
  { id: 6, name: "Kila", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila", area: "Ebisu" },
];

export default function FollowingPage() {
  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <main className="px-4 pt-4">
        <div className="space-y-3">
          {FOLLOWING.map((cast, i) => (
            <Link href={`/cast/${cast.id}`} key={cast.id}>
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-4 rounded-xl bg-white p-3 shadow-sm border border-slate-100"
              >
                <div className="h-14 w-14 rounded-full bg-slate-100 overflow-hidden border border-slate-100">
                  <img src={cast.image} alt={cast.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-slate-800">{cast.name}</h3>
                  <p className="text-xs text-slate-500">{cast.area}</p>
                </div>
                <button className="rounded-full bg-slate-100 px-4 py-1.5 text-xs font-bold text-slate-600">
                  Following
                </button>
              </motion.div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
