import type { BodyStatsView } from "@/modules/profile/types";

export function formatBodyStats(stats: BodyStatsView): string {
  const parts: string[] = [];

  if (stats.bust > 0) parts.push(`B${stats.bust}${stats.cup ? `(${stats.cup})` : ""}`);
  if (stats.waist > 0) parts.push(`W${stats.waist}`);
  if (stats.hip > 0) parts.push(`H${stats.hip}`);

  return parts.join(" ");
}

export function formatHeight(stats: BodyStatsView): string {
  return stats.heightCm > 0 ? `${stats.heightCm}cm` : "";
}
