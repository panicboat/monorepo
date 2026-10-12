"use client";

import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export function RouteFade({ children, transitionKey, className }: { children: ReactNode; transitionKey: string; className?: string }) {
  const element = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const target = element.current;
    // FALLBACK: Preserve the page in browsers without the Web Animations API.
    if (!target || typeof target.animate !== "function") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animation = preference.matches ? null : target.animate([{ opacity: 0.55 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
    // SILENT: Cancellation rejects finished during navigation and is an expected animation outcome.
    void animation?.finished.catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) console.error("Route animation failed", error); });
    const change = () => { if (preference.matches) animation?.cancel(); };
    preference.addEventListener("change", change);
    return () => { preference.removeEventListener("change", change); animation?.cancel(); };
  }, [transitionKey]);
  return <div ref={element} className={className}>{children}</div>;
}
