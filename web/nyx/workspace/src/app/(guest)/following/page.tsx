"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { useSocial } from "@/modules/social/hooks/useSocial";

const MOCK_DB = [
  {
    id: "1",
    name: "Yuna",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    area: "Roppongi",
  }, // Added Yuna
  {
    id: "2",
    name: "Maria",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    area: "Roppongi",
  },
  {
    id: "3",
    name: "Sarah",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    area: "Shibuya",
  },
  {
    id: "5",
    name: "Rin",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin",
    area: "Ginza",
  },
  {
    id: "6",
    name: "Kila",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila",
    area: "Ebisu",
  },
];

export default function FollowingPage() {
  const { following } = useSocial();
  const list = MOCK_DB.filter((cast) => following.includes(cast.id));

  return (
    <div className="bg-surface-secondary min-h-screen pb-20">
      <main className="px-4 pt-4">
        <div className="space-y-3">
          {list.length > 0 ? (
            list.map((cast, i) => (
              <Link href={`/casts/${cast.id}`} key={cast.id}>
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-4 rounded-xl bg-surface p-3 shadow-sm border border-border"
                >
                  <div className="h-14 w-14 rounded-full bg-surface-secondary overflow-hidden border border-border">
                    <img
                      src={cast.image}
                      alt={cast.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-text-primary">{cast.name}</h3>
                    <p className="text-xs text-text-secondary">{cast.area}</p>
                  </div>
                  <button className="rounded-full bg-surface-secondary px-4 py-1.5 text-xs font-bold text-text-secondary">
                    Following
                  </button>
                </motion.div>
              </Link>
            ))
          ) : (
            <div className="py-20 text-center text-text-muted">
              <p>Not following anyone yet.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
