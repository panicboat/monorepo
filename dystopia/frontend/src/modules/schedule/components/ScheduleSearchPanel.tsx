"use client";

import { useId, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/select";
import { Toggle } from "@/components/ui/toggle";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { useSearchSchedules } from "@/modules/discovery";
import { INDUSTRIES, PREFECTURES, areasOf } from "@/modules/profile/lib/constants";
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
  const { date, prefecture, area, industry, timeBand, followingOnly } = choices;
  const { results, hasMore, loading, error, loadMore } = useSearchSchedules({ date, prefecture, area, industry, timeBand, followingOnly, query });
  const narrowed = prefecture !== "" || area !== "" || industry !== "" || timeBand !== "" || followingOnly || query.trim() !== "";
  const areaChoices = areasOf(prefecture);

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
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            aria-label="都道府県"
            value={prefecture}
            onChange={(e) => onChoicesChange({ ...choices, prefecture: e.target.value, area: "" })}
          >
            <option value="">全国</option>
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          {areaChoices.length > 0 && (
            <Select aria-label="エリア" value={area} onChange={(e) => onChoicesChange({ ...choices, area: e.target.value })}>
              <option value="">{prefecture}のすべて</option>
              {areaChoices.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          )}
        </div>
      </FilterGroup>
      <FilterGroup title="業種">
        <div className="flex flex-wrap gap-2">
          <ToggleChip pressed={industry === ""} onClick={() => onChoicesChange({ ...choices, industry: "" })}>
            すべて
          </ToggleChip>
          {INDUSTRIES.map((i) => (
            <button
              key={i.name}
              type="button"
              aria-pressed={industry === i.name}
              aria-label={i.name}
              title={i.name}
              onClick={() => onChoicesChange({ ...choices, industry: industry === i.name ? "" : i.name })}
              className={cn(
                "flex size-11 items-center justify-center rounded-full border text-xl",
                industry === i.name ? "border-accent bg-accent/15" : "border-border hover:bg-bg-secondary"
              )}
            >
              <span aria-hidden="true">{i.icon}</span>
            </button>
          ))}
        </div>
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
