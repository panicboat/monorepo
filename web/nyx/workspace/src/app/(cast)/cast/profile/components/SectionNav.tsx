"use client";

import { cn } from "@/lib/utils";
import { MouseEvent } from "react";

interface SectionNavItem {
  id: string;
  label: string;
}

interface SectionNavProps {
  items: SectionNavItem[];
  activeId?: string; // Could be implemented later with intersection observer
  className?: string;
}

export const SectionNav = ({ items, activeId, className }: SectionNavProps) => {
  const handleScroll = (e: MouseEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      // Offset for header
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition =
        elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none",
        className,
      )}
    >
      {items.map((item) => (
        <button
          key={item.id}
          onClick={(e) => handleScroll(e, item.id)}
          className={cn(
            "flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all border",
            activeId === item.id
              ? "bg-slate-800 text-white border-slate-800"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};
