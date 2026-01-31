"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";

// Mock Data representing "Living Portfolio" (Realtime status)
const MOCK_CASTS = [
  {
    id: 1,
    name: "Yuna",
    tags: ["New", "Model"],
    status: "online",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    area: "Shinjuku",
  },
  {
    id: 2,
    name: "Maria",
    tags: [],
    status: "tonight",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    area: "Roppongi",
  },
  {
    id: 3,
    name: "Sarah",
    tags: ["Legend"],
    status: "offline",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    area: "Shibuya",
  },
  {
    id: 4,
    name: "Mio",
    tags: ["Rookie"],
    status: "tonight",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mio",
    area: "Shinjuku",
  },
  {
    id: 5,
    name: "Rin",
    tags: [],
    status: "online",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin",
    area: "Ginza",
  },
  {
    id: 6,
    name: "Kila",
    tags: [],
    status: "offline",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Kila",
    area: "Ebisu",
  },
  {
    id: 7,
    name: "Elena",
    tags: ["VIP"],
    status: "tonight",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena",
    area: "Roppongi",
  },
  {
    id: 8,
    name: "Aoi",
    tags: [],
    status: "online",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Aoi",
    area: "Akies",
  },
  {
    id: 9,
    name: "Nana",
    tags: [],
    status: "offline",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nana",
    area: "Shinjuku",
  },
  {
    id: 10,
    name: "Luna",
    tags: ["New"],
    status: "online",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
    area: "Shibuya",
  },
];

export const CastList = () => {
  return (
    <div className="grid grid-cols-2 gap-1 pb-20">
      {MOCK_CASTS.map((cast) => (
        <Link href={`/casts/${cast.id}`} key={cast.id}>
          <CastCard cast={cast} />
        </Link>
      ))}
    </div>
  );
};

const CastCard = ({ cast }: { cast: (typeof MOCK_CASTS)[0] }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-md bg-white shadow-sm"
    >
      {/* Image specific ratio - Hime-channel style is often vertical implementation 3:4 */}
      <div className="relative aspect-[3/4] w-full bg-slate-100">
        <Avatar className="h-full w-full rounded-none">
          <AvatarImage src={cast.image} alt={cast.name} className="object-cover" />
          <AvatarFallback className="rounded-none">C</AvatarFallback>
        </Avatar>

        {/* Status Badge (Living Portfolio) */}
        {cast.status === "online" && (
          <Badge className="absolute right-2 top-2 bg-green-500 border-white hover:bg-green-600 text-[10px] px-2 py-0.5 shadow-sm">
            ONLINE
          </Badge>
        )}
        {cast.status === "tonight" && (
          <Badge className="absolute right-2 top-2 bg-blue-400 border-white hover:bg-blue-500 text-[10px] px-2 py-0.5 shadow-sm">
            TONIGHT
          </Badge>
        )}

        {/* Labels/Tags Overlay Bottom */}
        <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 text-white">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-light opacity-90">{cast.area}</p>
              <h3 className="text-sm font-bold leading-tight">{cast.name}</h3>
            </div>
            {/* Pledge Rate (Trust) */}
            <div className="text-right">
              <span className="block text-[9px] opacity-75">Trust</span>
              <span className="font-mono text-xs font-bold text-yellow-400">
                98%
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
