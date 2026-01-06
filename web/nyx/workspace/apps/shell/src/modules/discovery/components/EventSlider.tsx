"use client";

import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

type EventItem = {
  id: string;
  title: string;
  subtitle: string;
  bg: string;
};

const events: EventItem[] = [
  { id: "1", title: "Newcomer Debut", subtitle: "Fresh faces this week", bg: "bg-gradient-to-r from-pink-500 to-rose-500" },
  { id: "2", title: "Rainy Day Special", subtitle: "20% Off all pledges", bg: "bg-gradient-to-r from-blue-400 to-cyan-500" },
  { id: "3", title: "Birthday Bash", subtitle: "Celebrate Yuna's Bday!", bg: "bg-gradient-to-r from-yellow-400 to-orange-500" },
  { id: "4", title: "Late Night", subtitle: "Double Trust Points", bg: "bg-gradient-to-r from-purple-500 to-indigo-600" },
  { id: "5", title: "Cosplay Week", subtitle: "Uniforms & Maid", bg: "bg-gradient-to-r from-green-400 to-emerald-600" },
];

export const EventSlider = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    const interval = setInterval(() => {
      // Calculate dynamic scroll amount based on first child width + gap
      const firstCard = scrollContainer.children[0] as HTMLElement;
      if (!firstCard) return;

      const cardWidth = firstCard.offsetWidth;
      const gap = 16; // gap-4
      const scrollAmount = cardWidth + gap;

      if (scrollContainer.scrollLeft + scrollContainer.clientWidth >= scrollContainer.scrollWidth - 10) {
        scrollContainer.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollContainer.scrollBy({ left: scrollAmount, behavior: "smooth" });
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isPaused]);

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar flex gap-4 overflow-x-auto px-8 py-6 w-full snap-x snap-mandatory focus:outline-none focus:ring-2 focus:ring-pink-500/20 rounded-xl"
      tabIndex={0}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setIsPaused(false)}
    >
      {events.map((evt) => (
        <motion.div
          key={evt.id}
          whileTap={{ scale: 0.97 }}
          className={`relative h-40 w-[85%] flex-shrink-0 snap-center overflow-hidden rounded-3xl p-6 text-white shadow-lg ${evt.bg}`}
        >
          <div className="relative z-10 flex h-full flex-col justify-between">
            <div>
              <span className="inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm tracking-wide">EVENT</span>
            </div>
            <div>
              <h3 className="text-2xl font-bold leading-tight mb-1">{evt.title}</h3>
              <p className="text-sm opacity-90 font-medium">{evt.subtitle}</p>
            </div>
          </div>
          {/* Decorative Circle */}
          <div className="absolute -bottom-8 -right-8 h-40 w-40 rounded-full bg-white/10 blur-2xl"></div>
        </motion.div>
      ))}
    </div>
  );
};
