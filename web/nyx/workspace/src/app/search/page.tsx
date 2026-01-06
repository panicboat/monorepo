"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, MapPin, Sparkles, ChevronRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";

const POPULAR_TAGS = ["#Newcomer", "#Model", "#Healer", "#English", "#Cosplay", "#Student"];

// Rich Mock Data
type CastData = {
  id: string;
  name: string;
  age: number;
  location: string;
  tags: string[];
  image: string;
  status: "online" | "tonight" | "offline";
  oneLiner: string;
};

const SEARCH_RESULTS: CastData[] = [
  {
    id: "1", name: "Yuna", age: 22, location: "Roppongi", tags: ["Model"],
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna",
    status: "online",
    oneLiner: "Just finished a ritual! 🕯️ Available for a chat."
  },
  {
    id: "2", name: "Maria", age: 20, location: "Shibuya", tags: ["Student"],
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    status: "tonight",
    oneLiner: "Anyone up for karaoke tonight? 🎤"
  },
  {
    id: "3", name: "Rin", age: 24, location: "Ginza", tags: ["Pro"],
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin",
    status: "offline",
    oneLiner: "Reflecting on a beautiful day..."
  },
  {
    id: "4", name: "Mio", age: 19, location: "Shinjuku", tags: ["Rookie"],
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Mio",
    status: "tonight",
    oneLiner: "New cosplay outfit just arrived! ✨"
  },
  {
    id: "5", name: "Sarah", age: 25, location: "Ebisu", tags: ["English"],
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
    status: "online",
    oneLiner: "Looking for interesting conversation. ☕"
  },
];

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState("all");

  const highlightCasts = SEARCH_RESULTS.filter(c => c.status === "online" || c.status === "tonight");

  return (
    <div className="bg-slate-50 pb-24 pt-4 min-h-screen">
      {/* Search Input */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 rounded-full bg-white p-3 shadow-sm border border-slate-100">
          <Search className="text-slate-400 ml-1" size={20} />
          <input
            type="text"
            placeholder="Search cast, tag, location..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-400"
          />
          <button className="text-slate-400 hover:text-slate-600 mr-1">
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <HorizontalScroll className="mb-6" contentClassName="px-4 gap-2">
        {["All", "Online", "New", "Ranking"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab.toLowerCase())}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors shadow-sm
                        ${activeTab === tab.toLowerCase()
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-500 border border-slate-100"
              }
                    `}
          >
            {tab}
          </button>
        ))}
      </HorizontalScroll>

      {/* Highlights (Horizontal Scroll) */}
      <div className="mb-8 relative">
        <div className="px-4 mb-3 flex items-center gap-2">
          <Sparkles className="text-yellow-500 w-4 h-4 fill-current" />
          <h3 className="font-bold text-sm text-slate-800 tracking-wider">今スグ遊べる</h3>
        </div>

        {/* Scroll Container with Snap */}
        <HorizontalScroll className="snap-x snap-mandatory" contentClassName="gap-3 px-4 pb-4 pr-6">
          {highlightCasts.map(cast => (
            <Link href={`/cast/${cast.id}`} key={cast.id} className="flex-shrink-0 w-28 snap-center">
              <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md">
                <img src={cast.image} alt={cast.name} className="h-full w-full object-cover pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <div className="text-white text-xs font-bold truncate">{cast.name}</div>
                  <div className={`text-[10px] font-bold ${cast.status === 'online' ? 'text-green-400' : 'text-pink-400'}`}>
                    {cast.status === 'online' ? '● ONLINE' : '● TONIGHT'}
                  </div>
                </div>
              </div>
            </Link>
          ))}
          {/* Spacer for last item to snap correctly - Not needed with HorizontalScroll PR padding, but nice for visual balance if desired */}
        </HorizontalScroll>

        {/* Strong Fade Mask on Right */}
        <div className="absolute right-0 top-8 bottom-4 w-12 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent pointer-events-none" />
      </div>

      {/* Main Grid Results */}
      <div className="px-4">
        <h3 className="mb-3 font-bold text-sm text-slate-500 uppercase tracking-wider">All Casts</h3>
        <div className="grid grid-cols-2 gap-3">
          {SEARCH_RESULTS.map(cast => (
            <SearchCastCard key={cast.id} cast={cast} />
          ))}
        </div>
      </div>

      {/* Popular Tags (Bottom) */}
      <div className="px-4 mt-8">
        <h3 className="mb-3 font-bold text-xs text-slate-400 uppercase tracking-wider">Trending Tags</h3>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TAGS.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full bg-white text-[10px] font-bold text-slate-500 border border-slate-100">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const SearchCastCard = ({ cast }: { cast: CastData }) => {
  return (
    <Link href={`/cast/${cast.id}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 h-full flex flex-col"
      >
        {/* Large Image Area */}
        <div className="relative aspect-square">
          <img src={cast.image} alt={cast.name} className="h-full w-full object-cover" />
          {cast.status !== 'offline' && (
            <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm
              ${cast.status === 'online' ? 'bg-green-500' : 'bg-pink-500'}`}>
              {cast.status.toUpperCase()}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-1">
            <h4 className="font-bold text-slate-800 text-base">{cast.name} <span className="text-xs font-normal text-slate-400">({cast.age})</span></h4>
            <div className="flex items-center text-[10px] text-slate-400">
              <MapPin size={10} className="mr-0.5" />
              {cast.location}
            </div>
          </div>

          {/* One-Liner Bubble */}
          <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg italic leading-tight relative">
            <div className="absolute -top-1 left-3 w-2 h-2 bg-slate-50 transform rotate-45" />
            "{cast.oneLiner}"
          </div>

          <div className="mt-auto pt-2 flex gap-1 flex-wrap">
            {cast.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">#{tag}</span>
            ))}
          </div>
        </div>
      </motion.div>
    </Link>
  );
};
