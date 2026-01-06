"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, MapPin, Clock, Tag } from "lucide-react";
import Link from "next/link";

const POPULAR_TAGS = ["#Newcomer", "#Model", "#Healer", "#English", "#Cosplay", "#Student"];
const SEARCH_RESULTS = [
  { id: "1", name: "Yuna", location: "Roppongi", tags: ["Model", "Healer"], image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Yuna" },
  { id: "2", name: "Maria", location: "Shibuya", tags: ["Student", "English"], image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria" },
  { id: "3", name: "Rin", location: "Ginza", tags: ["Pro", "Cool"], image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Rin" },
];

export default function SearchPage() {
  const [activeTab, setActiveTab] = useState("all");

  return (
    <div className="bg-slate-50 pb-24 pt-4">
      {/* Search Input */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-2 rounded-xl bg-white p-3 shadow-sm border border-slate-100">
          <Search className="text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Search cast, tag, location..."
            className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-slate-400"
          />
          <button className="text-slate-400 hover:text-slate-600">
            <SlidersHorizontal size={20} />
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 mb-6 overflow-x-auto no-scrollbar">
        <div className="flex gap-2">
          {["All", "Today", "New", "Ranking"].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors
                        ${activeTab === tab.toLowerCase()
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-500 border border-slate-200"
                }
                    `}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Popular Tags */}
      <div className="px-4 mb-8">
        <h3 className="mb-3 font-bold text-sm text-slate-400 uppercase tracking-wider">Popular Tags</h3>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TAGS.map(tag => (
            <button key={tag} className="px-3 py-1.5 rounded-lg bg-white border border-dashed border-slate-300 text-xs font-bold text-slate-600 hover:bg-pink-50 hover:text-pink-600 hover:border-pink-200 transition-colors">
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Results (Mock) */}
      <div className="px-4">
        <h3 className="mb-3 font-bold text-sm text-slate-400 uppercase tracking-wider">Recommended Results</h3>
        <div className="space-y-3">
          {SEARCH_RESULTS.map(cast => (
            <Link href={`/cast/${cast.id}`} key={cast.id}>
              <div className="flex items-center gap-4 rounded-xl bg-white p-3 shadow-sm border border-slate-100 mb-3 hover:bg-slate-50 transition-colors">
                <div className="h-14 w-14 rounded-full bg-slate-100 overflow-hidden">
                  <img src={cast.image} alt={cast.name} className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-900 truncate">{cast.name}</h4>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400">
                      <MapPin size={10} />
                      <span>{cast.location}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {cast.tags.map(tag => (
                      <span key={tag} className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
