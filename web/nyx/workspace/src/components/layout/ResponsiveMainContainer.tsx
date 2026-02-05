"use client";

import { ReactNode, CSSProperties } from "react";
import { cn } from "@/lib/utils";

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
  return (
    <div
      className={cn(
        "w-full sm:w-[450px] bg-surface min-h-screen pt-14 md:pt-16 shadow-sm ring-1 ring-border/10 pb-20 md:pb-0 transition-[width] duration-300 ease-in-out",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
};
