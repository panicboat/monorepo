"use client";

import { useEffect, useRef, type RefObject } from "react";

const ENTER_KEYFRAMES: Keyframe[] = [
  { opacity: 0.55, transform: "translateY(5px)" },
  { opacity: 1, transform: "translateY(0)" },
];

function fadeDurationMs(element: HTMLElement): number {
  const value = getComputedStyle(element).getPropertyValue("--duration-fade").trim();
  const amount = Number.parseFloat(value);
  if (Number.isNaN(amount)) return 0;
  return value.endsWith("ms") ? amount : amount * 1000;
}

export function useEnterAnimation(ref: RefObject<HTMLElement | null>, key: string): void {
  const shownKey = useRef(key);

  useEffect(() => {
    if (shownKey.current === key) return;
    shownKey.current = key;
    const element = ref.current;
    if (!element) return;
    // Read the length from the token so the reduced-motion override in CSS also silences this animation.
    const duration = fadeDurationMs(element);
    if (duration === 0) return;
    element.animate(ENTER_KEYFRAMES, { duration, easing: "ease" });
  }, [ref, key]);
}
