"use client";

import { PolygonRadarGraph } from "@/components/ui/PolygonRadarGraph";

const AXES = ["Looks", "Charm", "Tech", "Service", "Love"];

export const TrustRadar = ({ scores }: { scores: number[] }) => {
  return (
    <div className="flex flex-col items-center justify-center py-6 bg-white">
      <h3 className="mb-4 font-serif text-lg font-bold text-slate-900">Cast Ability</h3>
      <PolygonRadarGraph
        axes={AXES}
        scores={scores}
        color="pink"
        size={200}
      />
    </div>
  );
};
