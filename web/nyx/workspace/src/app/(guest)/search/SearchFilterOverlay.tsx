"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

type Genre = {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
};

type StatusFilter = "all" | "online" | "new" | "ranking";

type FilterState = {
  query: string;
  genreId: string;
  status: StatusFilter;
};

type SearchFilterOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  genres: Genre[];
  initialFilters: FilterState;
};

export function SearchFilterOverlay({
  isOpen,
  onClose,
  onApply,
  genres,
  initialFilters,
}: SearchFilterOverlayProps) {
  const [query, setQuery] = useState(initialFilters.query);
  const [genreId, setGenreId] = useState(initialFilters.genreId);
  const [status, setStatus] = useState<StatusFilter>(initialFilters.status);
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);

  // Fetch result count when filters change
  const fetchResultCount = useCallback(async () => {
    setLoadingCount(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("query", query.trim());
      if (genreId) params.set("genreId", genreId);
      if (status !== "all") params.set("status", status);
      params.set("limit", "1");

      const res = await fetch(`/api/guest/search?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setResultCount(data.items?.length >= 1 ? null : 0);
      }
    } catch {
      setResultCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [query, genreId, status]);

  useEffect(() => {
    if (isOpen) {
      const debounce = setTimeout(fetchResultCount, 300);
      return () => clearTimeout(debounce);
    }
  }, [isOpen, query, genreId, status, fetchResultCount]);

  // Reset local state when overlay opens
  useEffect(() => {
    if (isOpen) {
      setQuery(initialFilters.query);
      setGenreId(initialFilters.genreId);
      setStatus(initialFilters.status);
    }
  }, [isOpen, initialFilters]);

  const handleReset = () => {
    setQuery("");
    setGenreId("");
    setStatus("all");
  };

  const handleApply = () => {
    onApply({ query, genreId, status });
    onClose();
  };

  const activeFilterCount =
    (query.trim() ? 1 : 0) + (genreId ? 1 : 0) + (status !== "all" ? 1 : 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-white"
        >
          {/* Content container with slide animation */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="h-full flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <button
                onClick={onClose}
                className="p-2 -ml-2 text-slate-500 hover:text-slate-700"
              >
                <X size={24} />
              </button>
              <h2 className="font-bold text-lg text-slate-800">
                フィルター
              </h2>
              <div className="w-10" />
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-6">
              {/* Text Search */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-2">
                  キーワード検索
                </label>
                <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 border border-slate-200">
                  <Search className="text-slate-400 shrink-0" size={18} />
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
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Genre Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-3">
                  ジャンル
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setGenreId("")}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border
                      ${
                        genreId === ""
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
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
                            ? "bg-slate-900 text-white border-slate-900"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                      {genre.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status Selection */}
              <div>
                <label className="block text-sm font-bold text-slate-600 mb-3">
                  ステータス
                </label>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { key: "all", label: "すべて" },
                      { key: "online", label: "オンライン" },
                      { key: "new", label: "新着" },
                      { key: "ranking", label: "ランキング" },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setStatus(item.key)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border
                        ${
                          status === item.key
                            ? "bg-pink-500 text-white border-pink-500"
                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="sticky bottom-0 px-4 py-4 pb-24 border-t border-slate-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex items-center gap-2 text-slate-600"
                  disabled={activeFilterCount === 0}
                >
                  <RotateCcw size={16} />
                  リセット
                </Button>
                <Button
                  onClick={handleApply}
                  className="flex-1 bg-slate-900 text-white hover:bg-slate-800"
                >
                  {loadingCount
                    ? "読み込み中..."
                    : resultCount === 0
                      ? "該当なし"
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
