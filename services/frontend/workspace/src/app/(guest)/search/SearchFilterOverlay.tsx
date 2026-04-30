"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, RotateCcw, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { fadeVariants, slideUpVariants, springTransition } from "@/lib/motion";

type Genre = {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
};

type Area = {
  id: string;
  prefecture: string;
  name: string;
  code: string;
};

type StatusFilter = "all" | "online" | "new";

type FilterState = {
  query: string;
  genreId: string;
  status: StatusFilter;
  areaId: string;
  prefecture: string;
};

type SearchFilterOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  genres: Genre[];
  areas: Area[];
  areasByPrefecture: Map<string, Area[]>;
  prefectures: string[];
  initialFilters: FilterState;
};

export function SearchFilterOverlay({
  isOpen,
  onClose,
  onApply,
  genres,
  areas,
  areasByPrefecture,
  prefectures,
  initialFilters,
}: SearchFilterOverlayProps) {
  const [query, setQuery] = useState(initialFilters.query);
  const [genreId, setGenreId] = useState(initialFilters.genreId);
  const [status, setStatus] = useState<StatusFilter>(initialFilters.status);
  const [areaId, setAreaId] = useState(initialFilters.areaId);
  const [prefecture, setPrefecture] = useState(initialFilters.prefecture);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [expandedPrefectures, setExpandedPrefectures] = useState<Set<string>>(() => {
    if (initialFilters.areaId) {
      const selectedArea = areas.find((a) => a.id === initialFilters.areaId);
      if (selectedArea) return new Set([selectedArea.prefecture]);
    } else if (initialFilters.prefecture) {
      return new Set([initialFilters.prefecture]);
    }
    return new Set();
  });

  const togglePrefecture = (pref: string) => {
    setExpandedPrefectures((prev) => {
      const next = new Set(prev);
      if (next.has(pref)) {
        next.delete(pref);
      } else {
        next.add(pref);
      }
      return next;
    });
  };

  // Fetch result count when filters change
  const fetchResultCount = useCallback(async () => {
    if (!prefecture && !areaId) {
      setResultCount(null);
      return;
    }

    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      if (prefecture) params.set("prefecture", prefecture);
      if (areaId) params.set("areaId", areaId);
      if (query.trim()) params.set("query", query.trim());
      if (genreId) params.set("genreId", genreId);
      if (status !== "all") params.set("status", status);

      const res = await fetch(`/api/guest/search/count?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResultCount(data.count);
      }
    } catch {
      // SILENT: Result count is a non-critical UI hint
      setResultCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [query, genreId, status, areaId, prefecture]);

  useEffect(() => {
    if (isOpen) {
      const debounce = setTimeout(fetchResultCount, 300);
      return () => clearTimeout(debounce);
    }
  }, [isOpen, query, genreId, status, areaId, prefecture, fetchResultCount]);

  // Reset local state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialFilters.query);
      setGenreId(initialFilters.genreId);
      setStatus(initialFilters.status);
      setAreaId(initialFilters.areaId);
      setPrefecture(initialFilters.prefecture);
      if (initialFilters.areaId) {
        const selectedArea = areas.find((a) => a.id === initialFilters.areaId);
        if (selectedArea) setExpandedPrefectures(new Set([selectedArea.prefecture]));
      } else if (initialFilters.prefecture) {
        setExpandedPrefectures(new Set([initialFilters.prefecture]));
      } else {
        setExpandedPrefectures(new Set());
      }
    }
  }, [isOpen, initialFilters, areas]);

  const handleReset = () => {
    setQuery(""); setGenreId(""); setStatus("all"); setAreaId(""); setPrefecture("");
  };

  const handleApply = () => {
    onApply({ query, genreId, status, areaId, prefecture });
    onClose();
  };

  const activeFilterCount =
    (query.trim() ? 1 : 0) + (genreId ? 1 : 0) + (status !== "all" ? 1 : 0) + (areaId || prefecture ? 1 : 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          variants={fadeVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed inset-0 z-50 bg-surface"
        >
          {/* Content container with slide animation */}
          <motion.div
            variants={slideUpVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={springTransition}
            className="h-full flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-text-secondary hover:text-text-secondary"
              >
                <X size={24} />
              </button>
              <h2 className="font-bold text-lg text-text-primary">
                フィルター
              </h2>
              <div className="w-10" />
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-6">
              {/* Text Search */}
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-2">
                  キーワード検索
                </label>
                <div className="flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2 border border-border">
                  <Search className="text-text-muted shrink-0" size={18} />
                  <Input
                    type="text"
                    placeholder="名前、タグ、キャッチコピーで検索..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="flex-1 bg-transparent border-none shadow-none focus-visible:ring-0 px-1 text-sm"
                  />
                  {query && (
                    <button
                      onClick={() => setQuery("")}
                      className="text-text-muted hover:text-text-secondary"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Genre Selection */}
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-3">
                  ジャンル
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setGenreId("")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border
                      ${
                        genreId === ""
                          ? "bg-info text-white border-info"
                          : "bg-surface text-text-secondary border-border hover:bg-surface-secondary"
                      }`}
                  >
                    すべて
                  </button>
                  {genres.map((genre) => (
                    <button
                      key={genre.id}
                      onClick={() => setGenreId(genre.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border
                        ${
                          genreId === genre.id
                            ? "bg-info text-white border-info"
                            : "bg-surface text-text-secondary border-border hover:bg-surface-secondary"
                        }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-bold text-text-secondary mb-3">
                  ステータス
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "all", label: "すべて" },
                      { key: "online", label: "オンライン" },
                      { key: "new", label: "新着" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setStatus(item.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                        ${
                          status === item.key
                            ? "bg-info text-white border-info"
                            : "bg-surface text-text-secondary border-border hover:bg-surface-secondary"
                        }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area Selection */}
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-text-primary">エリア</h3>
                <div className="space-y-1">
                  {prefectures.map((pref) => (
                    <div key={pref}>
                      <div className="flex items-center gap-1">
                        {/* Prefecture name: clicking selects the whole prefecture */}
                        <button
                          onClick={() => {
                            if (prefecture === pref && !areaId) {
                              setPrefecture("");
                            } else {
                              setPrefecture(pref);
                              setAreaId("");
                            }
                          }}
                          className={`flex-1 text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
                            ${prefecture === pref && !areaId
                              ? "bg-info/10 text-info border border-info/30"
                              : "text-text-secondary hover:bg-surface-secondary"}`}
                        >
                          {pref}
                        </button>
                        {/* Expand button: toggles area list visibility */}
                        <button
                          onClick={() => togglePrefecture(pref)}
                          className="p-2 text-text-muted hover:text-text-secondary"
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${expandedPrefectures.has(pref) ? "rotate-180" : ""}`}
                          />
                        </button>
                      </div>
                      {/* Area grid (shown when expanded) */}
                      {expandedPrefectures.has(pref) && (
                        <div className="grid grid-cols-3 gap-2 mt-2 ml-2">
                          {(areasByPrefecture.get(pref) || []).map((area) => (
                            <button
                              key={area.id}
                              onClick={() => {
                                if (areaId === area.id) {
                                  setAreaId("");
                                  setPrefecture("");
                                } else {
                                  setAreaId(area.id);
                                  setPrefecture(pref);
                                }
                              }}
                              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors
                                ${areaId === area.id
                                  ? "bg-info/10 text-info border border-info/30"
                                  : "bg-surface-secondary text-text-secondary hover:bg-surface-secondary/80"}`}
                            >
                              {area.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="sticky bottom-0 px-4 py-4 pb-24 border-t border-border bg-surface shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex items-center gap-2 text-text-secondary"
                  disabled={activeFilterCount === 0}
                >
                  <RotateCcw size={16} />
                  リセット
                </Button>
                <Button
                  onClick={handleApply}
                  className="flex-1 bg-info text-white hover:bg-info-hover"
                >
                  {loadingCount
                    ? "読み込み中..."
                    : resultCount !== null
                      ? resultCount === 0
                        ? "該当なし"
                        : `適用する (${resultCount}件)`
                      : "適用する"}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
