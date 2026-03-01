"use client";

import { ReactNode, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming cn utility exists, if not use clsx or template literal

interface SectionCardProps {
  id?: string;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export const SectionCard = ({
  id,
  title,
  icon,
  children,
  collapsible = false,
  defaultOpen = true,
  className,
}: SectionCardProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const toggleOpen = () => {
    if (collapsible) setIsOpen(!isOpen);
  };

  return (
    <div
      id={id}
      className={cn(
        "bg-surface rounded-2xl shadow-sm border border-border overflow-hidden transition-all duration-300",
        className,
      )}
    >
      <div
        className={cn(
          "px-6 py-4 flex items-center justify-between",
          collapsible ? "cursor-pointer hover:bg-surface-secondary/50" : "",
        )}
        onClick={toggleOpen}
      >
        <h2 className="flex items-center gap-3 text-lg font-bold text-text-primary">
          {icon && <span className="text-accent">{icon}</span>}
          {title}
        </h2>
        {collapsible && (
          <button className="text-text-muted hover:text-text-secondary transition-colors">
            {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        )}
      </div>

      <div
        className={cn(
          "transition-all duration-300 ease-in-out px-6",
          isOpen
            ? "max-h-[2000px] opacity-100 pb-6"
            : "max-h-0 opacity-0 overflow-hidden pb-0",
        )}
      >
        {children}
      </div>
    </div>
  );
};
