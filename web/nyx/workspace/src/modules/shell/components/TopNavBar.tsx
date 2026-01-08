"use client";

import Link from "next/link";
import { ChevronLeft, ArrowLeft } from "lucide-react";
import { ReactNode } from "react";

interface TopNavBarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  /**
   * Component to render in the left slot (desktop logo, etc)
   * when not showing back button, or alongside it.
   */
  leftSlot?: ReactNode;
  /**
   * Component to render in the right slot (user avatar, etc)
   */
  rightSlot?: ReactNode;
  /**
   * Whether to use the 'ArrowLeft' icon (Cast style) or 'ChevronLeft' (Guest style)
   */
  backIconStyle?: "chevron" | "arrow";
  className?: string; // For custom styling overrides
}

export const TopNavBar = ({
  title,
  showBack = false,
  onBack,
  leftSlot,
  rightSlot,
  backIconStyle = "chevron",
  className = "",
}: TopNavBarProps) => {
  const BackIcon = backIconStyle === "arrow" ? ArrowLeft : ChevronLeft;

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 flex h-14 md:h-16 w-full items-center justify-center bg-white/80 backdrop-blur-md shadow-sm border-b border-slate-100 ${className}`}>
      <div className="w-full max-w-md md:max-w-7xl px-4 flex items-center justify-between">
        {/* LEFT COMPONENT */}
        <div className="flex items-center gap-4">
          {leftSlot}

          {/* Mobile Back Button */}
          <div className="md:hidden">
            {showBack ? (
              <button
                onClick={onBack}
                className={`flex items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200 ${backIconStyle === "arrow" ? "-ml-1 p-1" : "h-8 w-8"
                  }`}
              >
                <BackIcon size={backIconStyle === "arrow" ? 20 : 20} className={backIconStyle === "arrow" ? "h-5 w-5" : ""} />
              </button>
            ) : (
              // Spacer if no back button and no left slot visible on mobile (logic depends on usage)
              // If leftSlot handles its own visibility, we might just need a spacer if nothing occupies this area.
              // Simple placeholder logic:
              !leftSlot ? <div className="w-8"></div> : null
            )}
          </div>

          {/* Desktop Subpage Title & Back Button */}
          {showBack && (
            <div className="hidden md:flex items-center gap-2">
              <button onClick={onBack} className="p-1 hover:bg-slate-100 rounded-full text-slate-500 hover:text-slate-900 transition-colors">
                <BackIcon size={18} />
              </button>
              <span className="font-bold text-slate-900">{title}</span>
            </div>
          )}
        </div>

        {/* CENTER COMPONENT (Mobile Title) */}
        {!title ? null : (
          <span className="md:hidden font-serif text-lg font-bold tracking-tight text-slate-900 absolute left-1/2 -translate-x-1/2">
            {title}
          </span>
        )}


        {/* RIGHT COMPONENT */}
        <div className="flex items-center gap-3">
          {rightSlot}
        </div>
      </div>
    </header>
  );
};
