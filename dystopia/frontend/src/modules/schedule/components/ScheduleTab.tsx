"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LockedNotice } from "@/components/ui/locked-notice";
import { useSchedules } from "@/modules/schedule/hooks";
import { buildDateRangeThroughNextMonth, formatDayLabel } from "@/modules/schedule/lib/dates";
import { ScheduleBulkSheet } from "./ScheduleBulkSheet";

const OWNER_UNPLANNED_DAYS = 14;

interface Editing {
  session: number;
  open: boolean;
  todayOnly: boolean;
}

export function ScheduleTab({ profileId, isOwner }: { profileId: string; isOwner: boolean }) {
  const days = buildDateRangeThroughNextMonth(new Date());
  const { schedules, hiddenByLock, loading, refresh } = useSchedules(profileId, days[0], days[days.length - 1]);
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [editing, setEditing] = useState<Editing | null>(null);
  const byDate = new Map(schedules.map((s) => [s.workDate, s]));
  const visibleDays = days.filter((dateKey, index) => byDate.has(dateKey) || (isOwner && index < OWNER_UNPLANNED_DAYS));
  const openSheet = (todayOnly: boolean) =>
    setEditing((current) => ({ session: (current?.session ?? 0) + 1, open: true, todayOnly }));

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary">予定</h2>
        {isOwner && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" size="sm" onClick={() => openSheet(true)}>
              今日の予定
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => openSheet(false)}>
              まとめて編集
            </Button>
          </div>
        )}
      </div>
      {hiddenByLock ? (
        <LockedNotice />
      ) : loading ? (
        <p className="mt-3 text-sm text-text-secondary">読み込み中…</p>
      ) : visibleDays.length === 0 ? (
        <p className="mt-3 text-sm text-text-secondary">予定はありません</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {visibleDays.map((dateKey) => {
            const plan = byDate.get(dateKey);
            if (!plan) {
              return (
                <li key={dateKey} className="flex items-center gap-3 px-1 py-1 text-sm text-text-secondary">
                  <span className="font-bold">{formatDayLabel(dateKey)}</span>
                  <span>未設定</span>
                </li>
              );
            }
            return (
              <li key={dateKey} className="rounded-xl border border-border px-3 py-3">
                <span className="text-sm font-bold text-text-primary">{formatDayLabel(dateKey)}</span>
                <p className="mt-2 rounded-lg border border-border bg-surface px-3 py-2 text-lg font-bold tabular-nums text-text-primary">
                  {plan.startTime} 〜 {plan.endTime}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {!hiddenByLock && visibleDays.length > 0 && <p className="mt-3 text-xs text-text-secondary">予定は予約可能枠を保証するものではありません。</p>}
      {editing && (
        <ScheduleBulkSheet
          key={editing.session}
          profileId={profileId}
          open={editing.open}
          todayOnly={editing.todayOnly}
          onClose={() => setEditing((current) => current && { ...current, open: false })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
