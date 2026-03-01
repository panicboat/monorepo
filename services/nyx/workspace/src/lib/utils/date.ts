/**
 * Date Utilities
 *
 * Centralized date formatting functions.
 * Import from "@/lib/utils/date" instead of duplicating.
 */

/**
 * Format a date as relative time (e.g., "2m ago", "3h ago", "5d ago")
 *
 * @param dateString - ISO date string or any parseable date string
 * @returns Relative time string
 *
 * @example
 * formatTimeAgo("2024-01-01T12:00:00Z") // "2d ago"
 * formatTimeAgo(new Date().toISOString()) // "now"
 */
export function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 0) return "now"; // Future dates
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;

  // More than a week ago - show date
  return date.toLocaleDateString();
}

/**
 * Format a date for display
 *
 * @param dateString - ISO date string
 * @param options - Intl.DateTimeFormat options
 */
export function formatDate(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  }
): string {
  return new Date(dateString).toLocaleDateString("ja-JP", options);
}

/**
 * Format a time for display
 *
 * @param dateString - ISO date string
 * @param options - Intl.DateTimeFormat options
 */
export function formatTime(
  dateString: string,
  options: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  }
): string {
  return new Date(dateString).toLocaleTimeString("ja-JP", options);
}

/**
 * Format a datetime for display
 *
 * @param dateString - ISO date string
 */
export function formatDateTime(dateString: string): string {
  return `${formatDate(dateString)} ${formatTime(dateString)}`;
}
