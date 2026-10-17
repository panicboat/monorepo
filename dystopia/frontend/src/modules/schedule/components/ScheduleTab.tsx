"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSchedules } from "@/modules/schedule/hooks";
import { buildDateRange, formatDayLabel } from "@/modules/schedule/lib/dates";
import { ScheduleBulkSheet } from "./ScheduleBulkSheet";

const WEEK_DAYS = 7;
const TWO_WEEK_DAYS = 14;

interface Editing {
  session: number;
  open: boolean;
}

export function ScheduleTab({ profileId, isOwner }: { profileId: string; isOwner: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const days = buildDateRange(new Date(), expanded ? TWO_WEEK_DAYS : WEEK_DAYS);
  const { schedules, loading, refresh } = useSchedules(profileId, days[0], days[days.length - 1]);
  // Keep the sheet mounted after closing: unmounting it would cut its slide-out animation.
  const [editing, setEditing] = useState<Editing | null>(null);
  const byDate = new Map(schedules.map((s) => [s.workDate, s]));

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text-primary">出勤スケジュール</h2>
        {isOwner && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing((current) => ({ session: (current?.session ?? 0) + 1, open: true }))}
          >
            まとめて編集
          </Button>
        )}
      </div>
      {loading ? (
        <p className="mt-3 text-sm text-text-secondary">読み込み中…</p>
      ) : (
        <ol className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((dateKey) => {
            const plan = byDate.get(dateKey);
            return (
              <li
                key={dateKey}
                className={cn(
                  "flex min-h-20 flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center text-xs",
                  plan ? "border-accent/50 bg-accent/10 text-text-primary" : "border-border text-text-secondary"
                )}
              >
                <span className="font-bold">{formatDayLabel(dateKey)}</span>
                {plan ? (
                  <>
                    <span>{plan.startTime}</span>
                    <span>〜{plan.endTime}</span>
                  </>
                ) : (
                  <span>未設定</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {!expanded && (
        <button type="button" onClick={() => setExpanded(true)} className="mt-2 min-h-11 text-sm text-accent hover:underline">
          もっと見る
        </button>
      )}
      <p className="mt-3 text-xs text-text-secondary">出勤情報は予約可能枠を保証するものではありません。</p>
      {editing && (
        <ScheduleBulkSheet
          key={editing.session}
          profileId={profileId}
          open={editing.open}
          onClose={() => setEditing((current) => current && { ...current, open: false })}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
