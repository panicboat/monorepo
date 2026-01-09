"use client";

import { ReactNode, CSSProperties } from "react";
import { useWindowSize } from "@/hooks/useWindowSize";

interface ResponsiveMainContainerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export const ResponsiveMainContainer = ({
  children,
  className = "",
  style = {},
}: ResponsiveMainContainerProps) => {
  const { width } = useWindowSize();

  // Default max-width (fallback / server-side)
  // Tailwind max-w-md is 28rem = 448px.
  // We want to dynamically tune this.

  // Calculate dynamic style
  let containerStyle: CSSProperties = { ...style };

  if (width) {
    if (width < 640) {
      // Mobile: Full width
      containerStyle = { ...containerStyle, width: "100%" };
    } else {
      // Desktop/Tablet: Fixed "App" width
      // User requested fixed width closer to the sidebar gap.
      // 450px provides a solid app feel without being too wide.
      containerStyle = { ...containerStyle, width: "450px" };
    }
  }

  return (
    <div
      className={`bg-white min-h-screen pt-14 md:pt-16 shadow-sm ring-1 ring-slate-900/5 pb-20 md:pb-0 transition-[width] duration-300 ease-in-out ${className}`}
      style={containerStyle}
    >
      {children}
    </div>
  );
};
