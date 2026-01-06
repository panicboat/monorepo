"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Assuming we have some blocked users in mock
const BLOCKED = [
  { id: 99, name: "Unknown", image: "", date: "2023.12.01" },
];

export default function BlockingPage() {
  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <main className="px-4 pt-4">
        {BLOCKED.length > 0 ? (
          <div className="space-y-3">
            {BLOCKED.map((user) => (
              <div key={user.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-slate-100 opacity-75">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-xl text-slate-400">
                    🚫
                  </div>
                  <div>
                    <div className="font-bold text-slate-600">Blocked User</div>
                    <div className="text-[10px] text-slate-400">Since {user.date}</div>
                  </div>
                </div>
                <button className="text-xs font-bold text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full">
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
