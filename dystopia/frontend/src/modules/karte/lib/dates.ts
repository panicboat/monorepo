// The sv-SE locale formats a date as YYYY-MM-DD, the format the server expects.
const JAPAN_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

export function todayInJapan(now: Date = new Date()): string {
  return JAPAN_DATE.format(now);
}
