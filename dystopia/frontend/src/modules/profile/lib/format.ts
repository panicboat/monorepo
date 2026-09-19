import type { BodyStatsView } from "@/modules/profile/types";

export function formatBodyStats(stats: BodyStatsView): string {
  const parts: string[] = [];

  if (stats.bust > 0) parts.push(`B${stats.bust}${stats.cup ? `(${stats.cup})` : ""}`);
  if (stats.waist > 0) parts.push(`W${stats.waist}`);

  if (stats.hip > 0) {
    parts.push(`H${stats.hip}${stats.heightCm > 0 ? `(${stats.heightCm}cm)` : ""}`);
  } else if (stats.heightCm > 0) {
    parts.push(`${stats.heightCm}cm`);
  }

  return parts.join(" ");
}
