"use client";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { KARTE_OUTCOMES, KARTE_STAGES, KARTE_TAGS, MAX_NOTE_LENGTH, isNoteRequired } from "../lib/catalog";
import { todayInJapan } from "../lib/dates";
import type { KarteEventInput, KarteStage } from "../types";

export function emptyKarteEvent(today: string = todayInJapan()): KarteEventInput {
  return { stage: "reservation", outcome: KARTE_OUTCOMES.reservation[0].code, tags: [], note: "", occurredOn: today };
}

export function isKarteEventReady(event: KarteEventInput): boolean {
  if (event.occurredOn === "" || event.note.length > MAX_NOTE_LENGTH) return false;
  return !isNoteRequired(event.stage, event.outcome) || event.note.trim() !== "";
}

interface KarteEventFieldsProps {
  value: KarteEventInput;
  onChange: (next: KarteEventInput) => void;
}

export function KarteEventFields({ value, onChange }: KarteEventFieldsProps) {
  const toggleTag = (code: string) =>
    onChange({ ...value, tags: value.tags.includes(code) ? value.tags.filter((tag) => tag !== code) : [...value.tags, code] });

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        記録する段階
        <Select
          value={value.stage}
          onChange={(e) => {
            const stage = e.target.value as KarteStage;
            onChange({ ...value, stage, outcome: KARTE_OUTCOMES[stage][0].code, tags: [] });
          }}
        >
          {KARTE_STAGES.map((stage) => (
            <option key={stage.code} value={stage.code}>
              {stage.label}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        対応結果
        <Select value={value.outcome} onChange={(e) => onChange({ ...value, outcome: e.target.value })}>
          {KARTE_OUTCOMES[value.stage].map((outcome) => (
            <option key={outcome.code} value={outcome.code}>
              {outcome.label}
            </option>
          ))}
        </Select>
      </label>
      <fieldset className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
        <legend className="mb-1">詳細タグ（任意）</legend>
        {KARTE_TAGS[value.stage].map((tag) => (
          <label key={tag.code} className="flex items-center gap-1">
            <input type="checkbox" checked={value.tags.includes(tag.code)} onChange={() => toggleTag(tag.code)} />
            {tag.label}
          </label>
        ))}
      </fieldset>
      <label className="flex flex-col gap-1 text-sm">
        {isNoteRequired(value.stage, value.outcome) ? "補足（必須）" : "補足（任意）"}
        <Textarea value={value.note} maxLength={MAX_NOTE_LENGTH} onChange={(e) => onChange({ ...value, note: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        発生日
        <Input type="date" value={value.occurredOn} max={todayInJapan()} onChange={(e) => onChange({ ...value, occurredOn: e.target.value })} />
      </label>
    </div>
  );
}
