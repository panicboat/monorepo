"use client";

export type FilterType = "all" | "following" | "favorites";

interface TimelineFiltersProps {
  filter: FilterType;
  onChange: (filter: FilterType) => void;
}

export function TimelineFilters({ filter, onChange }: TimelineFiltersProps) {
  const filters: FilterType[] = ["all", "following", "favorites"];

  return (
    <div className="px-4 flex items-center justify-between">
      <h2 className="text-lg font-bold font-serif text-text-primary">
        Timeline
      </h2>

      <div className="flex bg-surface-secondary p-1 rounded-lg" role="tablist" aria-label="Timeline filters">
        {filters.map((tab) => (
          <button
            key={tab}
            onClick={() => onChange(tab)}
            role="tab"
            aria-selected={filter === tab}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              filter === tab
                ? "bg-surface text-text-primary shadow-sm"
                : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
