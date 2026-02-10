"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  SlidersHorizontal,
  MapPin,
  Sparkles,
  Loader2,
  Lock,
} from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { HorizontalScroll } from "@/components/ui/HorizontalScroll";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { SearchFilterOverlay } from "./SearchFilterOverlay";

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
  isPrivate?: boolean;
};

type CastItem = {
  profile: CastProfile | null;
  plans: { id: string; name: string; price: number; duration: number }[];
};

type StatusFilter = "all" | "online" | "new" | "ranking";

type FilterState = {
  query: string;
  genreId: string;
  status: StatusFilter;
};

export default function SearchPage() {
  const [filters, setFilters] = useState<FilterState>({
    query: "",
    genreId: "",
    status: "all",
  });
  const [activeTag, setActiveTag] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [filterOverlayOpen, setFilterOverlayOpen] = useState(false);

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
      if (filters.status !== "all") {
        params.set("status", filters.status);
      }
      if (filters.genreId) {
        params.set("genreId", filters.genreId);
      }
      if (filters.query.trim()) {
        params.set("query", filters.query.trim());
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
  }, [filters, activeTag]);

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

  const handleFilterApply = (newFilters: FilterState) => {
    setFilters(newFilters);
    setSearchInput(newFilters.query);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, query: searchInput }));
  };

  // Count active filters for badge
  const activeFilterCount =
    (filters.query.trim() ? 1 : 0) +
    (filters.genreId ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0);

  if (loading) {
    return (
      <div className="bg-surface-secondary min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="bg-surface-secondary pb-24 pt-4 min-h-screen">
      {/* Search Input */}
      <form onSubmit={handleSearchSubmit} className="px-4 mb-4">
        <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-1 shadow-sm border border-border">
          <Search className="text-text-muted ml-1 shrink-0" size={20} />
          <Input
            type="text"
            placeholder="キャスト、タグを検索..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-2"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setFilterOverlayOpen(true)}
            className="relative text-text-muted hover:text-text-secondary mr-1 hover:bg-transparent"
          >
            <SlidersHorizontal size={20} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-info text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Popular Tags (Top) */}
      {popularTags.length > 0 && (
        <div className="px-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <button
                key={tag.name}
                onClick={() => handleTagClick(tag.name)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-colors
                  ${activeTag === tag.name
                    ? "bg-info text-white border-info"
                    : "bg-surface text-text-secondary border-border hover:bg-surface-secondary"
                  }`}
              >
                #{tag.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {(filters.genreId || filters.status !== "all" || filters.query) && (
        <div className="px-4 mb-4">
          <div className="flex flex-wrap gap-2">
            {filters.query && (
              <span className="px-3 py-1 bg-border text-text-secondary rounded-full text-xs font-medium">
                &quot;{filters.query}&quot;
              </span>
            )}
            {filters.genreId && (
              <span className="px-3 py-1 bg-info text-white rounded-full text-xs font-medium">
                {genres.find((g) => g.id === filters.genreId)?.name}
              </span>
            )}
            {filters.status !== "all" && (
              <span className="px-3 py-1 bg-info text-white rounded-full text-xs font-medium">
                {filters.status === "online"
                  ? "オンライン"
                  : filters.status === "new"
                    ? "新着"
                    : "ランキング"}
              </span>
            )}
            <button
              onClick={() => {
                setFilters({ query: "", genreId: "", status: "all" });
                setSearchInput("");
              }}
              className="px-3 py-1 bg-surface-secondary text-text-secondary rounded-full text-xs font-medium hover:bg-border"
            >
              クリア
            </button>
          </div>
        </div>
      )}

      {/* Highlights (Horizontal Scroll) */}
      {highlightCasts.length > 0 && (
        <div className="mb-8 relative">
          <div className="px-4 mb-3 flex items-center gap-2">
            <Sparkles className="text-warning w-4 h-4 fill-current" />
            <h3 className="font-bold text-sm text-text-primary tracking-wider">
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
                      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white bg-success shadow-sm">
                        ● ONLINE
                      </div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <div className="text-white text-xs font-bold truncate flex items-center gap-1">
                        {cast.name}
                        {cast.isPrivate && (
                          <Lock size={10} className="text-white/70" />
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </HorizontalScroll>

          <div className="absolute right-0 top-8 bottom-4 w-12 bg-gradient-to-l from-surface-secondary via-surface-secondary/80 to-transparent pointer-events-none" />
        </div>
      )}

      {/* Main Grid Results */}
      <div className="px-4">
        <h3 className="mb-3 font-bold text-sm text-text-secondary uppercase tracking-wider">
          {filters.genreId
            ? genres.find((g) => g.id === filters.genreId)?.name || "Casts"
            : "All Casts"}
          {activeTag && ` - #${activeTag}`}
        </h3>

        {loadingCasts ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
          </div>
        ) : casts.length === 0 ? (
          <div className="text-center py-12 text-text-muted">
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


      {/* Filter Overlay */}
      <SearchFilterOverlay
        isOpen={filterOverlayOpen}
        onClose={() => setFilterOverlayOpen(false)}
        onApply={handleFilterApply}
        genres={genres}
        initialFilters={filters}
      />
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
        className="bg-surface rounded-xl overflow-hidden shadow-sm border border-border h-full flex flex-col"
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
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-success shadow-sm">
                ● ONLINE
              </div>
            )}
            {genreName && (
              <div className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-neutral-800/80 shadow-sm">
                {genreName}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3 flex-1 flex flex-col">
          <div className="flex justify-between items-end mb-1">
            <h4 className="font-bold text-text-primary text-base flex items-center gap-1">
              {cast.name}
              {cast.isPrivate && (
                <Lock size={12} className="text-text-muted" />
              )}
              {cast.age && (
                <span className="text-xs font-normal text-text-muted ml-1">
                  ({cast.age})
                </span>
              )}
            </h4>
            {areaName && (
              <div className="flex items-center text-[10px] text-text-muted">
                <MapPin size={10} className="mr-0.5" />
                {areaName}
              </div>
            )}
          </div>

          {/* Tagline Bubble */}
          {cast.tagline && (
            <div className="mt-2 text-xs text-text-secondary bg-surface-secondary p-2 rounded-lg italic leading-tight relative">
              <div className="absolute -top-1 left-3 w-2 h-2 bg-surface-secondary transform rotate-45" />
              &quot;{cast.tagline}&quot;
            </div>
          )}

          {cast.tags.length > 0 && (
            <div className="mt-auto pt-2 flex gap-1 flex-wrap">
              {cast.tags.slice(0, 2).map((tag) => (
                <span
                  key={tag.label}
                  className="text-[9px] text-text-muted bg-surface-secondary px-1.5 py-0.5 rounded"
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
