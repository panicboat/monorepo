"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { todayInJapan } from "@/lib/utils/japan-date";
import { useSearchSchedules, type ScheduleTimeBand } from "@/modules/discovery";
import { PREFECTURES } from "@/modules/profile/lib/constants";
import { buildDateRange, formatDayLabel, formatScheduleDay } from "@/modules/schedule/lib/dates";
import { ScheduleSearchCard } from "./ScheduleSearchCard";

const DAYS = 14;

const TIME_BANDS: Array<{ id: ScheduleTimeBand; label: string }> = [
  { id: "", label: "すべて" },
  { id: "day", label: "昼（〜17時）" },
  { id: "evening", label: "夜（18〜20時）" },
  { id: "night", label: "深夜（21時〜）" },
];

// Noon keeps every key on its own date when the device zone changes its UTC offset inside the range.
const searchDays = () => buildDateRange(new Date(`${todayInJapan()}T12:00:00`), DAYS);

const dayLabel = (dateKey: string, index: number) => (index === 0 ? "今日" : index === 1 ? "明日" : formatDayLabel(dateKey));

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <div className="px-4 py-2">
      <span id={titleId} className="text-xs font-bold text-text-secondary">
        {title}
      </span>
      <div role="group" aria-labelledby={titleId} className="mt-2">
        {children}
      </div>
    </div>
  );
}

export function ScheduleSearchPanel({ query }: { query: string }) {
  const days = useMemo(searchDays, []);
  const [date, setDate] = useState(days[0]);
  const [prefecture, setPrefecture] = useState("");
  const [timeBand, setTimeBand] = useState<ScheduleTimeBand>("");
  const [followingOnly, setFollowingOnly] = useState(false);
  const { results, hasMore, loading, error, loadMore } = useSearchSchedules({ date, prefecture, timeBand, followingOnly, query });

  return (
    <div>
      <FilterGroup title="出勤日">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {days.map((dateKey, index) => (
            <div key={dateKey} className="shrink-0 whitespace-nowrap">
              <ToggleChip pressed={dateKey === date} onClick={() => setDate(dateKey)}>
                {dayLabel(dateKey, index)}
              </ToggleChip>
            </div>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="エリア">
        <Select aria-label="エリア" value={prefecture} onChange={(e) => setPrefecture(e.target.value)}>
          <option value="">全国</option>
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup title="開始時間帯">
        <div className="flex flex-wrap gap-2">
          {TIME_BANDS.map((band) => (
            <ToggleChip key={band.id} pressed={band.id === timeBand} onClick={() => setTimeBand(band.id)}>
              {band.label}
            </ToggleChip>
          ))}
        </div>
      </FilterGroup>
      <label className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-text-primary">
        <span>フォロー中だけを見る</span>
        <Toggle checked={followingOnly} onCheckedChange={setFollowingOnly} aria-label="フォロー中だけを見る" />
      </label>

      <h2 className="border-t border-divider px-4 pb-2 pt-4 text-base font-bold text-text-primary">{formatScheduleDay(date)}の出勤予定</h2>
      {results.length === 0 &&
        (loading ? (
          <p className="px-4 py-6 text-text-secondary">検索中…</p>
        ) : error ? (
          <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました</p>
        ) : (
          <p className="px-4 py-6 text-text-secondary">この日の出勤予定はまだありません</p>
        ))}
      {results.map((result) => (
        <ScheduleSearchCard key={`${result.schedule.profileId}:${result.schedule.workDate}`} result={result} />
      ))}
      {hasMore && (
        <div className="flex justify-center px-4 py-6">
          <Button variant="secondary" size="md" onClick={loadMore} disabled={loading}>
            もっと見る
          </Button>
        </div>
      )}
      <p className="px-4 pb-4 pt-2 text-xs text-text-secondary">
        キャストが公開した出勤予定です。予約の空きや受付可否を保証するものではありません。
      </p>
    </div>
  );
}
