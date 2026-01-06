"use client";

import { motion } from "framer-motion";

type ChartData = {
  subject: string;
  A: number; // 1-100
  fullMark: number;
};

// Pentagon Radar Chart
// Axes: Looks, Charm, Tech, Service, Love
// Angles: -90 (top), -18 (top right), 54 (bottom right), 126 (bottom left), 198 (top left)
// Wait, 5 points: 0, 72, 144, 216, 288 degrees starting from top?
// Top is -90deg in standard unit circle? Let's use simple trig.
// Top (Looks): (0, -r)
// Top Right (Love): (r*sin(72), -r*cos(72)) ...
// Let's use a simpler mapping.

const AXES = ["Looks", "Charm", "Tech", "Service", "Love"];

const valueToPoint = (value: number, index: number, total: number, radius: number, center: number) => {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const x = center + (radius * (value / 100)) * Math.cos(angle);
  const y = center + (radius * (value / 100)) * Math.sin(angle);
  return `${x},${y}`;
};

export const TrustRadar = ({ scores }: { scores: number[] }) => {
  const size = 200;
  const center = size / 2;
  const radius = 80;

  const polyPoints = scores.map((val, i) => valueToPoint(val, i, 5, radius, center)).join(" ");
  const bgPoints = [100, 100, 100, 100, 100].map((val, i) => valueToPoint(val, i, 5, radius, center)).join(" ");
  const levels = [20, 40, 60, 80].map(level => {
    return [1, 2, 3, 4, 5].map((_, i) => valueToPoint(level, i, 5, radius, center)).join(" ");
  });

  return (
    <div className="flex flex-col items-center justify-center py-6 bg-white">
      <h3 className="mb-4 font-serif text-lg font-bold text-slate-900">Cast Ability</h3>
      <div className="relative h-[200px] w-[200px]">
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Web */}
          {levels.map((points, i) => (
            <polygon key={i} points={points} fill="none" stroke="#e2e8f0" strokeWidth="1" />
          ))}
          <polygon points={bgPoints} fill="none" stroke="#cbd5e1" strokeWidth="1" />

          {/* Data Shape */}
          <motion.polygon
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 0.6, scale: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            points={polyPoints}
            fill="#ec4899"
            stroke="#db2777"
            strokeWidth="2"
            className="opacity-60"
          />

          {/* Axis Labels */}
          {AXES.map((label, i) => {
            const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
            // Push labels out a bit
            const labelR = radius + 20;
            const x = center + labelR * Math.cos(angle);
            const y = center + labelR * Math.sin(angle);
            return (
              <text
                key={label}
                x={x}
                y={y + 4} // slight adjustment for vertical center
                textAnchor="middle"
                className="text-[10px] font-bold fill-slate-500 uppercase tracking-wider"
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
