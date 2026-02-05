"use client";

import { X } from "lucide-react";
import { useGenres } from "@/modules/portfolio/hooks/useGenres";
import { Genre } from "@/modules/portfolio/types";

interface GenreSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxSelections?: number;
}

export const GenreSelector = ({
  selectedIds,
  onChange,
  maxSelections = 3,
}: GenreSelectorProps) => {
  const { genres, loading } = useGenres();

  const selectedGenres = genres.filter((g) => selectedIds.includes(g.id));

  const handleToggleGenre = (genre: Genre) => {
    if (selectedIds.includes(genre.id)) {
      onChange(selectedIds.filter((id) => id !== genre.id));
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, genre.id]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-role-cast border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected genres */}
      {selectedGenres.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedGenres.map((genre) => (
            <span
              key={genre.id}
              className="inline-flex items-center gap-1 rounded-full bg-role-cast-light px-3 py-1 text-sm text-role-cast-hover"
            >
              {genre.name}
              <button
                type="button"
                onClick={() => handleRemove(genre.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-role-cast-light"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Genre buttons */}
      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => {
          const isSelected = selectedIds.includes(genre.id);
          const isDisabled = !isSelected && selectedIds.length >= maxSelections;

          return (
            <button
              key={genre.id}
              type="button"
              onClick={() => handleToggleGenre(genre)}
              disabled={isDisabled}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isSelected
                  ? "bg-role-cast text-white shadow-sm"
                  : isDisabled
                  ? "bg-surface-secondary text-text-muted cursor-not-allowed"
                  : "bg-surface-secondary text-text-secondary hover:bg-neutral-200"
              }`}
            >
              {genre.name}
            </button>
          );
        })}
      </div>

      <p className="text-[10px] text-text-muted">
        最低1つ、最大{maxSelections}ジャンルまで選択できます（{selectedIds.length}/{maxSelections}）
      </p>
    </div>
  );
};
