"use client";

import { PolygonRadarGraph } from "@/components/ui/PolygonRadarGraph";

const AXES = ["Promise", "Manners", "Response", "Generosity", "History"];

export const GuestRadar = ({
  scores = [80, 80, 80, 80, 80],
  className = "",
}: {
  scores?: number[];
  className?: string;
}) => {
  return (
    <PolygonRadarGraph
      axes={AXES}
      scores={scores}
      color="amber"
      size={200} // GuestRadar in Dashboard was using size=120 internally but Dashboard passed className w-[200px] h-[200px].
      // The new component uses size logic.
      // Let's set default to 200 to match the previous visual intent of the dashboard usage which forced it to 200px.
      className={className}
    />
  );
};
