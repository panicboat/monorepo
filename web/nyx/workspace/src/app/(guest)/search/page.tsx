"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Sparkles,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Genre = {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
};

type PopularTag = {
  name: string;
  usageCount: number;
};

type CastProfile = {
  name: string;
  handle: string;
  tagline: string;
  bio: string;
  imageUrl: string;
  avatarUrl: string;
  age?: number;
  areas: { id: string; name: string; prefecture: string; code: string }[];
  genres: { id: string; name: string; slug: string; displayOrder: number }[];
  tags: { label: string; count: number }[];
  isOnline?: boolean;
};

type CastItem = {
  profile: CastProfile | null;
  plans: { id: string; name: string; price: number; duration: number }[];
};

type StatusFilter = "all" | "online" | "new" | "ranking";

export default function SearchPage() {
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("all");
  const [activeGenre, setActiveGenre] = useState<string>("");
  const [activeTag, setActiveTag] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [genres, setGenres] = useState<Genre[]>([]);
  const [popularTags, setPopularTags] = useState<PopularTag[]>([]);
  const [casts, setCasts] = useState<CastItem[]>([]);
  const [highlightCasts, setHighlightCasts] = useState<CastItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingCasts, setLoadingCasts] = useState(false);

  // Fetch genres and popular tags on mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        const [genresRes, tagsRes, highlightRes] = await Promise.all([
          fetch("/api/guest/genres"),
          fetch("/api/guest/tags/popular?limit=10"),
          fetch("/api/guest/search?status=online&limit=10"),
        ]);

        if (genresRes.ok) {
          const data = await genresRes.json();
          setGenres(data.genres || []);
        }

        if (tagsRes.ok) {
          const data = await tagsRes.json();
          setPopularTags(data.tags || []);
        }

        if (highlightRes.ok) {
          const data = await highlightRes.json();
          setHighlightCasts(data.items || []);
        }
      } catch (error) {
        console.error("Failed to fetch initial data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, []);

  // Fetch casts when filters change
  const fetchCasts = useCallback(async () => {
    setLoadingCasts(true);
    try {
      const params = new URLSearchParams();
      if (activeStatus !== "all") {
        params.set("status", activeStatus);
      }
      if (activeGenre) {
        params.set("genreId", activeGenre);
      }
      if (activeTag) {
        params.set("tag", activeTag);
      }

      const res = await fetch(`/api/guest/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCasts(data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch casts:", error);
    } finally {
      setLoadingCasts(false);
    }
  }, [activeStatus, activeGenre, activeTag]);

  useEffect(() => {
    fetchCasts();
  }, [fetchCasts]);

  const handleTagClick = (tagName: string) => {
    if (activeTag === tagName) {
      setActiveTag("");
    } else {
      setActiveTag(tagName);
    }
  };

  const handleGenreClick = (genreId: string) => {
    if (activeGenre === genreId) {
      setActiveGenre("");
    } else {
      setActiveGenre(genreId);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="bg-slate-50 pb-24 pt-4 min-h-screen">
      {/* Search Input */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm border border-slate-100">
          <Search className="text-slate-400 ml-1 shrink-0" size={20} />
          <Input
            type="text"
            placeholder="キャスト、タグ、エリアを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-2"
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-400 hover:text-slate-600 mr-1 hover:bg-transparent"
          >
            <SlidersHorizontal size={20} />
          </Button>
        </div>
      </div>

      {/* Genre Filter Pills */}
      {genres.length > 0 && (
        <HorizontalScroll className="mb-4" contentClassName="px-4 gap-2">
          <Button
            onClick={() => setActiveGenre("")}
            variant={activeGenre === "" ? "default" : "outline"}
            className={`rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors shadow-sm h-8
              ${activeGenre === ""
                ? "bg-slate-900 text-white hover:bg-slate-800"
                : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
              }`}
          >
            すべて
          </Button>
          {genres.map((genre) => (
            <Button
              key={genre.id}
              onClick={() => handleGenreClick(genre.id)}
              variant={activeGenre === genre.id ? "default" : "outline"}
              className={`rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors shadow-sm h-8
                ${activeGenre === genre.id
                  ? "bg-slate-900 text-white hover:bg-slate-800"
                  : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                }`}
            >
              {genre.name}
            </Button>
          ))}
        </HorizontalScroll>
      )}

      {/* Status Filter Tabs */}
      <HorizontalScroll className="mb-6" contentClassName="px-4 gap-2">
        {(
          [
            { key: "all", label: "All" },
            { key: "online", label: "Online" },
            { key: "new", label: "New" },
            { key: "ranking", label: "Ranking" },
          ] as const
        ).map((tab) => (
          <Button
            key={tab.key}
            onClick={() => setActiveStatus(tab.key)}
            variant={activeStatus === tab.key ? "default" : "outline"}
            className={`rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 transition-colors shadow-sm h-8
              ${activeStatus === tab.key
                ? "bg-pink-500 text-white hover:bg-pink-600"
                : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
              }`}
          >
            {tab.label}
          </Button>
        ))}
      </HorizontalScroll>

      {/* Highlights (Horizontal Scroll) */}
      {highlightCasts.length > 0 && (
        <div className="mb-8 relative">
          <div className="px-4 mb-3 flex items-center gap-2">
            <Sparkles className="text-yellow-500 w-4 h-4 fill-current" />
            <h3 className="font-bold text-sm text-slate-800 tracking-wider">
              今スグ遊べる
            </h3>
          </div>

          <HorizontalScroll
            className="snap-x snap-mandatory"
            contentClassName="gap-3 px-4 pb-4 pr-6"
          >
            {highlightCasts.map((item, index) => {
              if (!item.profile) return null;
              const cast = item.profile;
              return (
                <Link
                  href={`/casts/${cast.handle || index}`}
                  key={cast.handle || index}
                  className="flex-shrink-0 w-28 snap-center"
                >
                  <div className="relative aspect-[3/4] rounded-xl overflow-hidden shadow-md">
                    <img
                      src={cast.avatarUrl || cast.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cast.name}`}
                      alt={cast.name}
                      className="h-full w-full object-cover pointer-events-none"
                    />
                    {cast.isOnline && (
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white bg-green-500 shadow-sm">
                        ● ONLINE
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <div className="text-white text-xs font-bold truncate">
                        {cast.name}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </HorizontalScroll>

          <div className="absolute right-0 top-8 bottom-4 w-12 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Main Grid Results */}
      <div className="px-4">
        <h3 className="mb-3 font-bold text-sm text-slate-500 uppercase tracking-wider">
          {activeGenre
            ? genres.find((g) => g.id === activeGenre)?.name || "Casts"
            : "All Casts"}
          {activeTag && ` - #${activeTag}`}
        </h3>

        {loadingCasts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
          </div>
        ) : casts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            キャストが見つかりませんでした
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {casts.map((item, index) => {
              if (!item.profile) return null;
              return (
                <SearchCastCard
                  key={item.profile.handle || index}
                  cast={item.profile}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Popular Tags (Bottom) */}
      {popularTags.length > 0 && (
        <div className="px-4 mt-8">
          <h3 className="mb-3 font-bold text-xs text-slate-400 uppercase tracking-wider">
            Trending Tags
          </h3>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => handleTagClick(tag.name)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors
                  ${activeTag === tag.name
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-100 hover:bg-slate-50"
                  }`}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const SearchCastCard = ({ cast }: { cast: CastProfile }) => {
  const areaName = cast.areas?.[0]?.name || "";
  const genreName = cast.genres?.[0]?.name || "";

  return (
    <Link href={`/casts/${cast.handle || cast.name}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 h-full flex flex-col"
      >
        {/* Large Image Area */}
        <div className="relative aspect-square">
          <img
            src={cast.avatarUrl || cast.imageUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${cast.name}`}
            alt={cast.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute top-2 left-2 flex gap-1">
            {cast.isOnline && (
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-green-500 shadow-sm">
                ● ONLINE
              </div>
            )}
            {genreName && (
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-slate-800/80 shadow-sm">
                {genreName}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-1">
            <h4 className="font-bold text-slate-800 text-base">
              {cast.name}
              {cast.age && (
                <span className="text-xs font-normal text-slate-400 ml-1">
                  ({cast.age})
                </span>
              )}
            </h4>
            {areaName && (
              <div className="flex items-center text-[10px] text-slate-400">
                <MapPin size={10} className="mr-0.5" />
                {areaName}
              </div>
            )}
          </div>

          {/* Tagline Bubble */}
          {cast.tagline && (
            <div className="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg italic leading-tight relative">
              <div className="absolute -top-1 left-3 w-2 h-2 bg-slate-50 transform rotate-45" />
              "{cast.tagline}"
            </div>
          )}

          {cast.tags.length > 0 && (
            <div className="mt-auto pt-2 flex gap-1 flex-wrap">
              {cast.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.label}
                  className="text-[9px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded"
                >
                  #{tag.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
};
