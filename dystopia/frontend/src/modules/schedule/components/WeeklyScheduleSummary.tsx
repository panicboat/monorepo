"use client";

import { useSchedules } from "@/modules/schedule/hooks";
import { buildDateRange, formatMonthDay } from "@/modules/schedule/lib/dates";

const DAYS = 7;

export function WeeklyScheduleSummary({ profileId, onShowMore }: { profileId: string; onShowMore: () => void }) {
  const days = buildDateRange(new Date(), DAYS);
  const { schedules, loading } = useSchedules(profileId, days[0], days[DAYS - 1]);

  if (loading) return null;

  const shifts = [...schedules]
    .sort((a, b) => a.workDate.localeCompare(b.workDate))
    .map((s) => `${formatMonthDay(s.workDate)} ${s.startTime}〜${s.endTime}`);

  return (
    <section aria-label="今週の出勤" className="mx-4 mt-4 rounded-xl border border-border bg-surface px-4 py-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-primary">今週の出勤</h2>
        <button type="button" onClick={onShowMore} className="min-h-11 text-sm text-accent hover:underline">
          もっと見る →
        </button>
      </div>
      <p className="pb-1 text-sm text-text-secondary">{shifts.length > 0 ? shifts.join("　") : "今週の出勤予定はありません"}</p>
    </section>
  );
}
