"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { useSocial } from "@/modules/social/hooks/useSocial";

const MOCK_DB = [
  { id: "1", name: "Yuna", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna", area: "Roppongi" },
  { id: "2", name: "Maria", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria", area: "Roppongi" },
  { id: "3", name: "Sarah", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah", area: "Shibuya" },
  { id: "5", name: "Rin", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin", area: "Ginza" },
  { id: "6", name: "Kila", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila", area: "Ebisu" },
];

export default function BlockingPage() {
  const { blocking, toggleBlock } = useSocial();
  // Filter DB for blocked users. If user not in DB (e.g. unknown), we could show ID, but here we scan DB.
  // Real app would fetch specific IDs.
  const list = MOCK_DB.filter(cast => blocking.includes(cast.id));

  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <main className="px-4 pt-4">
        {list.length > 0 ? (
          <div className="space-y-3">
            {list.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-slate-100 opacity-75">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex-shrink-0 overflow-hidden">
                    <img src={user.image} alt={user.name} className="h-full w-full object-cover opacity-80" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-600">{user.name}</div>
                    <div className="text-[10px] text-slate-400">Blocked</div>
                  </div>
                </div>
                <button
                  onClick={() => toggleBlock(user.id)}
                  className="text-xs font-bold text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full hover:bg-slate-100 active:scale-95 transition-all"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center text-slate-400">
            <p>No blocked users.</p>
          </div>
        )}
      </main>
    </div>
  );
}
