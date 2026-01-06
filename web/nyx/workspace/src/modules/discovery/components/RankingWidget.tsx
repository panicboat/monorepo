"use client";

import { motion } from "framer-motion";

type RankItem = {
  id: string;
  name: string;
  image: string;
  score: string;
  change: "up" | "down" | "same";
};

const ranks: RankItem[] = [
  { id: "1", name: "Yuna", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna", score: "99.8%", change: "up" },
  { id: "2", name: "Mio", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mio", score: "98.5%", change: "same" },
  { id: "3", name: "Rin", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin", score: "97.2%", change: "down" },
  { id: "4", name: "Sara", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sara", score: "96.5%", change: "up" },
  { id: "5", name: "Kila", image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila", score: "95.0%", change: "same" },
];

import { HorizontalScroll } from "@/components/ui/HorizontalScroll";

export const RankingWidget = () => {
  return (
    <div className="py-2">
      <div className="mb-3 flex items-center justify-between px-4">
        <h2 className="text-lg font-bold font-serif text-slate-800">Trust Ranking</h2>
        <span className="text-xs font-bold text-pink-500">Weekly</span>
      </div>

      <HorizontalScroll contentClassName="gap-4 px-4 pb-4 cursor-grab active:cursor-grabbing">
        {ranks.map((cast, index) => (
          <div key={cast.id} className="relative flex-shrink-0">
            {/* Crown for Top 3 */}
            {index < 3 && (
              <div className="absolute -top-3 -right-2 text-2xl drop-shadow-sm">
                {index === 0 ? "👑" : index === 1 ? "🥈" : "🥉"}
              </div>
            )}

            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex flex-col items-center gap-1"
            >
              <div className={`relative h-16 w-16 overflow-hidden rounded-full border-2
                    ${index === 0 ? "border-yellow-400 p-0.5" : "border-slate-100"}
                `}>
                <img
                  src={cast.image}
                  alt={cast.name}
                  className="h-full w-full rounded-full object-cover pointer-events-none" // prevent img drag interfering
                />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-[10px] text-center text-white font-bold backdrop-blur-[1px]">
                  {index + 1}
                </div>
              </div>
              <div className="text-xs font-medium text-slate-700">{cast.name}</div>
              <div className="text-[10px] font-bold text-slate-400">{cast.score}</div>
            </motion.div>
          </div>
        ))}
      </HorizontalScroll>
    </div>
  );
};
