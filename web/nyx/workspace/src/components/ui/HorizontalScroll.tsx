"use client";

import { useRef, useState, useEffect, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string; // Container class
  contentClassName?: string; // Inner flex class
}

export const HorizontalScroll = ({ children, className = "", contentClassName = "" }: HorizontalScrollProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [showArrows, setShowArrows] = useState(false);

  const checkScroll = () => {
    if (!ref.current) return;
    const { scrollWidth, clientWidth } = ref.current;
    // Show arrows if there is scrollable content
    setShowArrows(scrollWidth > clientWidth);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, []);

  const scroll = (direction: "left" | "right") => {
    if (!ref.current) return;
    const container = ref.current;
    const scrollAmount = container.clientWidth / 2;
    const maxScroll = container.scrollWidth - container.clientWidth;

    let targetScroll;

    if (direction === "left") {
      // Loop to end if at start (with small buffer)
      if (container.scrollLeft <= 5) { // 5px buffer
        targetScroll = maxScroll;
      } else {
        targetScroll = container.scrollLeft - scrollAmount;
      }
    } else {
      // Loop to start if at end (with small buffer)
      if (container.scrollLeft >= maxScroll - 5) {
        targetScroll = 0;
      } else {
        targetScroll = container.scrollLeft + scrollAmount;
      }
    }

    container.scrollTo({
      left: targetScroll,
      behavior: "smooth"
    });
  };

  return (
    <div className="relative group">
      {/* Left Arrow */}
      {showArrows && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-opacity hidden sm:flex"
        >
          <ChevronLeft size={20} className="text-slate-700" />
        </button>
      )}

      <div
        ref={ref}
        onScroll={checkScroll}
        className={`overflow-x-auto no-scrollbar flex ${className} ${contentClassName}`}
      >
        {children}
      </div>

      {/* Right Arrow */}
      {showArrows && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-md hover:bg-white transition-opacity hidden sm:flex"
        >
          <ChevronRight size={20} className="text-slate-700" />
        </button>
      )}
    </div>
  );
};
