const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
const MS_PER_DAY = 86_400_000;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

export function buildDateRange(start: Date, days: number): string[] {
  return Array.from({ length: days }, (_, i) => toDateKey(new Date(start.getTime() + i * MS_PER_DAY)));
}
