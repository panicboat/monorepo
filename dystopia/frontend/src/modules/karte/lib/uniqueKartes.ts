import type { Karte } from "../types";

export function uniqueKartes(kartes: Karte[]): Karte[] {
  const seen = new Set<string>();
  return kartes.filter((karte) => {
    if (seen.has(karte.id)) return false;
    seen.add(karte.id);
    return true;
  });
}
