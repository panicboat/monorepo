"use client";

import { useRef, useState, MouseEvent, ReactNode } from "react";

interface HorizontalScrollProps {
  children: ReactNode;
  className?: string; // Container class
  contentClassName?: string; // Inner flex class
}

export const HorizontalScroll = ({ children, className = "", contentClassName = "" }: HorizontalScrollProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const onMouseDown = (e: MouseEvent) => {
    if (!ref.current) return;
    setIsDragging(true);
    setStartX(e.pageX - ref.current.offsetLeft);
    setScrollLeft(ref.current.scrollLeft);
  };

  const onMouseLeave = () => {
    setIsDragging(false);
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  const onMouseMove = (e: MouseEvent) => {
    if (!isDragging || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast factor
    ref.current.scrollLeft = scrollLeft - walk;
  };

  // Prevent click events during drag (cleanup)
  const onCaptureClick = (e: MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onClickCapture={onCaptureClick} // Try to prevent click if dragged? (Tricky with native click vs drag)
      className={`overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing flex ${className} ${contentClassName}`}
    >
      {children}
    </div>
  );
};
