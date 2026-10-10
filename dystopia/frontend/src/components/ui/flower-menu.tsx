"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { petalAt, petalPositions, type FlowerSpread } from "./flowerGeometry";

export interface FlowerMenuItem {
  id: string;
  label: string;
  icon: ReactNode;
}

export interface FlowerMenuProps {
  items: FlowerMenuItem[];
  spread: FlowerSpread;
  radius: number;
  label: string;
  onSelect: (id: string) => void;
  className?: string;
  triggerClassName?: string;
  children: ReactNode;
}

export function FlowerMenu({ items, spread, radius, label, onSelect, className, triggerClassName, children }: FlowerMenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pressRef = useRef<{ wasOpen: boolean; moved: boolean } | null>(null);
  const petals = useMemo(() => petalPositions(items.length, spread, radius), [items.length, spread, radius]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const select = (index: number) => {
    close();
    onSelect(items[index].id);
  };

  const petalUnder = (e: ReactPointerEvent) => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return -1;
    return petalAt(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2), petals);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    // Keep receiving the pointer after it leaves the trigger, so sliding onto a petal and releasing selects it.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    pressRef.current = { wasOpen: open, moved: false };
    setOpen(true);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!pressRef.current) return;
    const index = petalUnder(e);
    if (index !== -1) pressRef.current.moved = true;
    setActive(index);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const press = pressRef.current;
    pressRef.current = null;
    if (!press) return;
    const index = petalUnder(e);
    if (index !== -1) return select(index);
    setActive(-1);
    if (press.wasOpen && !press.moved) setOpen(false);
  };

  const onPointerCancel = () => {
    pressRef.current = null;
    close();
  };

  return (
    <div className={cn("relative", open && "z-50", className)}>
      {open && <div className="fixed inset-0 bg-black/70" onClick={close} aria-hidden="true" />}
      <div role="menu" aria-label={label}>
        {items.map((item, index) => {
          const petal = petals[index];
          const isActive = active === index;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={open ? 0 : -1}
              onClick={() => select(index)}
              className={cn(
                "absolute left-1/2 top-1/2 flex h-[52px] w-[52px] items-center justify-center rounded-full border border-border bg-bg-secondary text-text-primary transition-[transform,opacity] duration-200",
                open ? "opacity-100" : "pointer-events-none opacity-0",
                isActive && "border-transparent bg-gradient-brand text-white"
              )}
              style={{
                transform: open
                  ? `translate(calc(-50% + ${petal.x}px), calc(-50% + ${petal.y}px)) scale(${isActive ? 1.18 : 1})`
                  : "translate(-50%, -50%) scale(0.4)",
              }}
            >
              {item.icon}
              <span
                className="pointer-events-none absolute left-1/2 top-1/2 whitespace-nowrap text-xs font-bold text-white"
                style={{ transform: `translate(calc(-50% + ${petal.labelX}px), calc(-50% + ${petal.labelY}px))` }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          setOpen((current) => !current);
        }}
        className={cn("relative touch-none select-none", triggerClassName)}
      >
        {children}
      </button>
    </div>
  );
}
