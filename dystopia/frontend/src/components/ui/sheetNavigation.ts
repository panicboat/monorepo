"use client";

import { createContext, useContext } from "react";

export const SheetNavigationContext = createContext<((href: string) => void) | null>(null);

export function useSheetNavigation() {
  return useContext(SheetNavigationContext);
}
