"use client";

import { motion } from "motion/react";
import clsx from "clsx";

type PolygonRadarGraphProps = {
  axes: string[];
  scores: number[];
  color?: "pink" | "amber";
  className?: string;
  size?: number;
};

const THEME = {
  pink: {
    fill: "rgba(244, 114, 182, 0.2)", // pink-400 optimized opacity
    stroke: "#ec4899", // pink-500
    labelFill: "fill-slate-500",
  },
  amber: {
    fill: "rgba(245, 158, 11, 0.2)", // amber-500 optimized opacity
    stroke: "#d97706", // amber-600
    labelFill: "fill-slate-400",
  },
};

const valueToPoint = (
  value: number,
  index: number,
  total: number,
  radius: number,
  center: number,
) => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const x = center + radius * (value / 100) * Math.cos(angle);
  const y = center + radius * (value / 100) * Math.sin(angle);
  return `${x},${y}`;
};

export const PolygonRadarGraph = ({
  axes,
  scores,
  color = "pink",
  className,
  size = 200,
}: PolygonRadarGraphProps) => {
  const center = size / 2;
  // Radius should be roughly 40% of size to leave room for labels
  const radius = size * 0.4;
  const theme = THEME[color];

  const totalPoints = axes.length;

  const polyPoints = scores
    .map((val, i) => valueToPoint(val, i, totalPoints, radius, center))
    .join(" ");
  const bgPoints = Array(totalPoints)
    .fill(100)
    .map((val, i) => valueToPoint(val, i, totalPoints, radius, center))
    .join(" ");

  // Background levels (20%, 40%, 60%, 80%)
  const levels = [20, 40, 60, 80].map((level) => {
    return Array(totalPoints)
      .fill(level)
      .map((_, i) => valueToPoint(level, i, totalPoints, radius, center))
      .join(" ");
  });

  // Calculate mid-points (50%) for grid if needed, but using levels approach from TrustRadar is cleaner.
  // Wait, TrustRadar used [20,40,60,80] and GuestRadar used [50, 100].
  // Let's standardize on the more detailed TrustRadar style (20/40/60/80/100) as it looks better.

  return (
    <div
      className={clsx("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible w-full h-full"
      >
        {/* Background Web */}
        {levels.map((points, i) => (
          <polygon
            key={i}
            points={points}
            fill="none"
            stroke="rgba(203, 213, 225, 0.5)"
            strokeWidth="1"
          />
        ))}
        {/* Outer Boundary */}
        <polygon
          points={bgPoints}
          fill="rgba(60, 60, 60, 0.02)"
          stroke="rgba(203, 213, 225, 0.5)"
          strokeWidth="1"
        />

        {/* Axis Lines */}
        {Array(totalPoints)
          .fill(0)
          .map((_, i) => {
            const p = valueToPoint(100, i, totalPoints, radius, center);
            const [x2, y2] = p.split(",");
            return (
              <line
                key={i}
                x1={center}
                y1={center}
                x2={x2}
                y2={y2}
                stroke="rgba(203, 213, 225, 0.5)"
                strokeWidth="1"
              />
            );
          })}

        {/* Data Shape */}
        <motion.polygon
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 0.6, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          points={polyPoints}
          fill={theme.fill}
          stroke={theme.stroke}
          strokeWidth="2"
        />

        {/* Axis Labels */}
        {axes.map((label, i) => {
          const angle = (Math.PI * 2 * i) / totalPoints - Math.PI / 2;
          // Push labels out dynamically based on size
          const labelR = radius + size * 0.1;
          const x = center + labelR * Math.cos(angle);
          const y = center + labelR * Math.sin(angle);

          return (
            <text
              key={label}
              x={x}
              y={y + size * 0.02} // slight vertical adjustment
              textAnchor="middle"
              className={clsx(
                "font-bold uppercase tracking-wider",
                theme.labelFill,
              )}
              style={{ fontSize: Math.max(10, size * 0.05) + "px" }} // Responsive font size
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
