"use client";

import { useId, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { useSearchSchedules } from "@/modules/discovery";
import { PREFECTURES } from "@/modules/profile/lib/constants";
import { formatDayLabel, formatScheduleDay } from "@/modules/schedule/lib/dates";
import { TIME_BANDS, searchDays, type ScheduleSearchChoices } from "@/modules/schedule/lib/searchChoices";
import { ScheduleSearchCard } from "./ScheduleSearchCard";

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

interface ScheduleSearchPanelProps {
  query: string;
  choices: ScheduleSearchChoices;
  onChoicesChange: (choices: ScheduleSearchChoices) => void;
}

export function ScheduleSearchPanel({ query, choices, onChoicesChange }: ScheduleSearchPanelProps) {
  const days = useMemo(searchDays, []);
  const { date, prefecture, timeBand, followingOnly } = choices;
  const { results, hasMore, loading, error, loadMore } = useSearchSchedules({ date, prefecture, timeBand, followingOnly, query });
  const narrowed = prefecture !== "" || timeBand !== "" || followingOnly || query.trim() !== "";

  return (
    <div>
      <FilterGroup title="出勤日">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4">
          {days.map((dateKey, index) => (
            <div key={dateKey} className="shrink-0 whitespace-nowrap">
              <ToggleChip pressed={dateKey === date} onClick={() => onChoicesChange({ ...choices, date: dateKey })}>
                {dayLabel(dateKey, index)}
              </ToggleChip>
            </div>
          ))}
        </div>
      </FilterGroup>
      <FilterGroup title="エリア">
        <Select aria-label="エリア" value={prefecture} onChange={(e) => onChoicesChange({ ...choices, prefecture: e.target.value })}>
          <option value="">全国</option>
          {PREFECTURES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </FilterGroup>
      <FilterGroup title="勤務時間帯">
        <div className="flex flex-wrap gap-2">
          {TIME_BANDS.map((band) => (
            <ToggleChip key={band.id} pressed={band.id === timeBand} onClick={() => onChoicesChange({ ...choices, timeBand: band.id })}>
              {band.label}
            </ToggleChip>
          ))}
        </div>
      </FilterGroup>
      <label className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-text-primary">
        <span>フォロー中だけを見る</span>
        <Toggle checked={followingOnly} onCheckedChange={(checked) => onChoicesChange({ ...choices, followingOnly: checked })} aria-label="フォロー中だけを見る" />
      </label>

      <h2 className="border-t border-divider px-4 pb-2 pt-4 text-base font-bold text-text-primary">{formatScheduleDay(date)}の出勤予定</h2>
      {results.length === 0 &&
        (loading ? (
          <p className="px-4 py-6 text-text-secondary">検索中…</p>
        ) : error ? (
          <p className="px-4 py-6 text-text-secondary">読み込みに失敗しました</p>
        ) : (
          <p className="px-4 py-6 text-text-secondary">{narrowed ? "条件に合う出勤予定はありません" : "この日の出勤予定はまだありません"}</p>
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
