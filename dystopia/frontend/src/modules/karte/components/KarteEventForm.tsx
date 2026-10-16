"use client";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { KARTE_OUTCOMES, KARTE_STAGES, KARTE_TAGS, MAX_NOTE_LENGTH, isNoteRequired } from "../lib/catalog";
import { todayInJapan } from "../lib/dates";
import type { KarteEventInput } from "../types";
import { KarteRatingInput } from "./KarteRatingInput";

export interface KarteGuest {
  displayName: string;
  username: string;
  avatarUrl: string;
}

export function emptyKarteEvent(today: string = todayInJapan()): KarteEventInput {
  return { stage: "reservation", outcome: KARTE_OUTCOMES.reservation[0].code, tags: [], note: "", occurredOn: today };
}

export function isKarteEventReady(event: KarteEventInput): boolean {
  if (event.occurredOn === "" || event.note.length > MAX_NOTE_LENGTH) return false;
  return !isNoteRequired(event.stage, event.outcome) || event.note.trim() !== "";
}

const CHIP = "min-h-11 rounded-full border px-4 text-sm";
const chipClass = (selected: boolean) =>
  cn(CHIP, selected ? "border-accent bg-accent/15 text-text-primary" : "border-border text-text-secondary hover:text-text-primary");

interface KarteEventFormProps {
  guest: KarteGuest;
  value: KarteEventInput;
  onChange: (next: KarteEventInput) => void;
  rating?: { value: number | null; onChange: (next: number | null) => void };
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function KarteEventForm({ guest, value, onChange, rating, submitLabel, submitting, error, onSubmit }: KarteEventFormProps) {
  const toggleTag = (code: string) =>
    onChange({ ...value, tags: value.tags.includes(code) ? value.tags.filter((tag) => tag !== code) : [...value.tags, code] });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
        <Avatar src={guest.avatarUrl || undefined} fallback={guest.displayName.slice(0, 1) || "?"} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-text-primary">{guest.displayName}</p>
          <p className="truncate text-xs text-text-secondary">@{guest.username} · すべてのキャストに共有</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-text-primary">記録する段階</legend>
        <div className="flex flex-wrap gap-2">
          {KARTE_STAGES.map((stage) => (
            <button
              key={stage.code}
              type="button"
              aria-pressed={value.stage === stage.code}
              onClick={() => onChange({ ...value, stage: stage.code, outcome: KARTE_OUTCOMES[stage.code][0].code, tags: [] })}
              className={chipClass(value.stage === stage.code)}
            >
              {stage.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        対応結果
        <Select value={value.outcome} onChange={(e) => onChange({ ...value, outcome: e.target.value })}>
          {KARTE_OUTCOMES[value.stage].map((outcome) => (
            <option key={outcome.code} value={outcome.code}>
              {outcome.label}
            </option>
          ))}
        </Select>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-text-primary">詳細タグ（任意）</legend>
        <div className="flex flex-wrap gap-2">
          {KARTE_TAGS[value.stage].map((tag) => (
            <button
              key={tag.code}
              type="button"
              aria-pressed={value.tags.includes(tag.code)}
              onClick={() => toggleTag(tag.code)}
              className={chipClass(value.tags.includes(tag.code))}
            >
              {tag.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        {isNoteRequired(value.stage, value.outcome) ? "補足（必須）" : "補足（任意）"}
        <Textarea
          value={value.note}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="具体的な出来事や補足を記録してください"
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        発生日
        <Input type="date" value={value.occurredOn} max={todayInJapan()} onChange={(e) => onChange({ ...value, occurredOn: e.target.value })} />
      </label>

      {rating && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-text-primary">予約・接客の信頼性</legend>
          <KarteRatingInput value={rating.value} onChange={rating.onChange} />
          <p className="mt-1 text-xs text-text-secondary">3.0 が標準。評価はカルテ全体につき 1 つです。星は完了するときに必要です</p>
        </fieldset>
      )}

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting || !isKarteEventReady(value)}>
        {submitLabel}
      </Button>
    </form>
  );
}
