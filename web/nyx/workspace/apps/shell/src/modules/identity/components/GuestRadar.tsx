"use client";

import { motion } from "framer-motion";

const AXES = ["Promise", "Manners", "Response", "Generosity", "History"];

const valueToPoint = (value: number, index: number, total: number, radius: number, center: number) => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const x = center + (radius * (value / 100)) * Math.cos(angle);
  const y = center + (radius * (value / 100)) * Math.sin(angle);
  return `${x},${y}`;
};

export const GuestRadar = ({ scores = [80, 80, 80, 80, 80] }: { scores?: number[] }) => {
  const size = 120; // Smaller size for the widget
  const center = size / 2;
  const radius = 35; // Adjusted radius to fit labels

  // Data Shape
  const polyPoints = scores.map((val, i) => valueToPoint(val, i, 5, radius, center)).join(" ");
  // Background Pentagon (100%)
  const bgPoints = [100, 100, 100, 100, 100].map((val, i) => valueToPoint(val, i, 5, radius, center)).join(" ");
  // Inner Grid (50%)
  const midPoints = [50, 50, 50, 50, 50].map((val, i) => valueToPoint(val, i, 5, radius, center)).join(" ");

  return (
    <div className="relative h-[120px] w-[120px] flex-shrink-0 -my-4">
      <svg width={size} height={size} className="overflow-visible">
        {/* Background Grids */}
        <polygon points={bgPoints} fill="rgba(0, 0, 0, 0.02)" stroke="rgba(203, 213, 225, 0.5)" strokeWidth="0.5" />
        <polygon points={midPoints} fill="none" stroke="rgba(203, 213, 225, 0.5)" strokeWidth="0.5" />

        {/* Axis Lines */}
        {[0, 1, 2, 3, 4].map(i => {
          const p = valueToPoint(100, i, 5, radius, center);
          return <line key={i} x1={center} y1={center} x2={p.split(',')[0]} y2={p.split(',')[1]} stroke="rgba(203, 213, 225, 0.5)" strokeWidth="0.5" />;
        })}

        {/* Data Shape */}
        <motion.polygon
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 0.8, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          points={polyPoints}
          fill="rgba(245, 158, 11, 0.2)" // Amber-500 with lower opacity
          stroke="#d97706" // Amber-600
          strokeWidth="1.5"
        />

        {/* Labels - Darker for light bg */}
        {AXES.map((label, i) => {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const labelR = radius + 14;
          const x = center + labelR * Math.cos(angle);
          const y = center + labelR * Math.sin(angle);
          return (
            <text
              key={label}
              x={x}
              y={y + 3}
              textAnchor="middle"
              className="text-[8px] font-bold fill-slate-400 uppercase tracking-wider"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
