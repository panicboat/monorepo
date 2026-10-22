// The sv-SE locale formats a date as YYYY-MM-DD, the format the server expects.
const JAPAN_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

const JAPAN_TIME = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit" });

export function todayInJapan(now: Date = new Date()): string {
  return JAPAN_DATE.format(now);
}

export function formatMonthDay(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function formatMonthDayTimeInJapan(iso: string): string {
  const date = new Date(iso);
  return `${formatMonthDay(JAPAN_DATE.format(date))} ${JAPAN_TIME.format(date)}`;
}
