"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";

const FAVORITES = [
  {
    id: 1,
    name: "Yuna",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    area: "Shinjuku",
    tags: ["Model"],
  },
  {
    id: 4,
    name: "Mio",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mio",
    area: "Shinjuku",
    tags: ["Rookie"],
  },
  {
    id: 7,
    name: "Elena",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena",
    area: "Roppongi",
    tags: ["VIP"],
  },
];

export default function FavoritesPage() {
  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      <main className="px-4 pt-4">
        <div className="grid grid-cols-2 gap-3">
          {FAVORITES.map((cast, i) => (
            <Link href={`/cast/${cast.id}`} key={cast.id}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="relative overflow-hidden rounded-xl bg-white shadow-sm"
              >
                <div className="aspect-[3/4] w-full bg-slate-200 relative">
                  <Avatar className="h-full w-full rounded-none">
                    <AvatarImage src={cast.image} alt={cast.name} className="object-cover" />
                    <AvatarFallback className="rounded-none">C</AvatarFallback>
                  </Avatar>
                  <div className="absolute top-2 right-2 rounded-full bg-white/20 p-1.5 backdrop-blur-sm">
                    <span className="text-xs">❤️</span>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 p-3 pt-8 text-white">
                    <h3 className="font-bold">{cast.name}</h3>
                    <p className="text-[10px] opacity-80">{cast.area}</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
