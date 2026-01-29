"use client";

import { useState } from "react";
import { MapPin, X, ChevronDown } from "lucide-react";
import { useAreas } from "@/modules/portfolio/hooks/useAreas";
import { Area } from "@/modules/portfolio/types";

interface AreaSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxSelections?: number;
}

export const AreaSelector = ({
  selectedIds,
  onChange,
  maxSelections = 3,
}: AreaSelectorProps) => {
  const { areas, areasByPrefecture, prefectures, loading } = useAreas();
  const [expandedPrefecture, setExpandedPrefecture] = useState<string | null>(null);

  const selectedAreas = areas.filter((a) => selectedIds.includes(a.id));

  const handleToggleArea = (area: Area) => {
    if (selectedIds.includes(area.id)) {
      onChange(selectedIds.filter((id) => id !== area.id));
    } else if (selectedIds.length < maxSelections) {
      onChange([...selectedIds, area.id]);
    }
  };

  const handleRemove = (id: string) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Selected areas */}
      {selectedAreas.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAreas.map((area) => (
            <span
              key={area.id}
              className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-3 py-1 text-sm text-pink-700"
            >
              <MapPin size={12} />
              {area.name}
              <button
                type="button"
                onClick={() => handleRemove(area.id)}
                className="ml-1 rounded-full p-0.5 hover:bg-pink-200"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Prefecture accordion */}
      <div className="space-y-1 rounded-lg border border-slate-200 bg-white">
        {prefectures.map((prefecture) => {
          const prefectureAreas = areasByPrefecture.get(prefecture) || [];
          const isExpanded = expandedPrefecture === prefecture;
          const selectedInPrefecture = prefectureAreas.filter((a) =>
            selectedIds.includes(a.id)
          ).length;

          return (
            <div key={prefecture}>
              <button
                type="button"
                onClick={() =>
                  setExpandedPrefecture(isExpanded ? null : prefecture)
                }
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  {prefecture}
                  {selectedInPrefecture > 0 && (
                    <span className="rounded-full bg-pink-500 px-2 py-0.5 text-xs text-white">
                      {selectedInPrefecture}
                    </span>
                  )}
                </span>
                <ChevronDown
                  size={16}
                  className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                />
              </button>
              {isExpanded && (
                <div className="flex flex-wrap gap-2 px-4 pb-3">
                  {prefectureAreas.map((area) => {
                    const isSelected = selectedIds.includes(area.id);
                    const isDisabled =
                      !isSelected && selectedIds.length >= maxSelections;

                    return (
                      <button
                        key={area.id}
                        type="button"
                        onClick={() => handleToggleArea(area)}
                        disabled={isDisabled}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          isSelected
                            ? "bg-pink-500 text-white"
                            : isDisabled
                            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {area.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-slate-400">
        最大{maxSelections}エリアまで選択できます（{selectedIds.length}/{maxSelections}）
      </p>
    </div>
  );
};
