"use client";

import { Avatar } from "@/components/ui/avatar";
import { MISSING_CAST, ProfileName, profileInitial } from "@/components/ui/profile-name";
import type { ProfileSummaryView } from "@/modules/profile/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { StarRatingInput } from "@/components/ui/star-rating-input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { todayInJapan } from "@/lib/utils/japan-date";
import { REVIEW_OUTCOMES, REVIEW_STAGES, REVIEW_TAGS, MAX_NOTE_LENGTH, isNoteRequired } from "../lib/catalog";
import type { ReviewEventInput } from "../types";
import { ActingProfileLabel } from "@/modules/profile/components/ActingProfileLabel";

export function emptyReviewEvent(today: string = todayInJapan()): ReviewEventInput {
  return { stage: "reservation", outcome: REVIEW_OUTCOMES.reservation[0].code, tags: [], note: "", occurredOn: today };
}

export function isReviewEventReady(event: ReviewEventInput): boolean {
  if (event.occurredOn === "" || event.note.length > MAX_NOTE_LENGTH) return false;
  return !isNoteRequired(event.stage, event.outcome) || event.note.trim() !== "";
}

interface ReviewEventFormProps {
  cast: ProfileSummaryView | null;
  value: ReviewEventInput;
  onChange: (next: ReviewEventInput) => void;
  rating?: { value: number | null; onChange: (next: number | null) => void };
  submitLabel: string;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

export function ReviewEventForm({ cast, value, onChange, rating, submitLabel, submitting, error, onSubmit }: ReviewEventFormProps) {
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
      <ActingProfileLabel />
      <div className="flex items-center gap-3 rounded-lg bg-surface px-3 py-2">
        <Avatar src={cast?.avatarUrl || undefined} fallback={profileInitial(cast)} size="sm" />
        <div className="min-w-0">
          <p className="flex min-w-0 text-sm"><ProfileName profile={cast} missing={MISSING_CAST} /></p>
          <p className="truncate text-xs text-text-secondary">{cast?.username ? `@${cast.username} · ` : ""}全員に公開</p>
        </div>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-text-primary">記録する段階</legend>
        <div className="flex flex-wrap gap-2">
          {REVIEW_STAGES.map((stage) => (
            <ToggleChip
              key={stage.code}
              pressed={value.stage === stage.code}
              onClick={() => onChange({ ...value, stage: stage.code, outcome: REVIEW_OUTCOMES[stage.code][0].code, tags: [] })}
            >
              {stage.label}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        対応結果
        <Select value={value.outcome} onChange={(e) => onChange({ ...value, outcome: e.target.value })}>
          {REVIEW_OUTCOMES[value.stage].map((outcome) => (
            <option key={outcome.code} value={outcome.code}>
              {outcome.label}
            </option>
          ))}
        </Select>
      </label>

      <fieldset>
        <legend className="mb-2 text-sm font-bold text-text-primary">詳細タグ（任意）</legend>
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS[value.stage].map((tag) => (
            <ToggleChip key={tag.code} pressed={value.tags.includes(tag.code)} onClick={() => toggleTag(tag.code)}>
              {tag.label}
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        {isNoteRequired(value.stage, value.outcome) ? "補足（必須）" : "補足（任意）"}
        <Textarea
          value={value.note}
          maxLength={MAX_NOTE_LENGTH}
          placeholder="店舗規約や法律に反する行為（裏引き・本番等）の記載は禁止です。写真とのギャップや接客の雰囲気などを記入してください"
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-bold text-text-primary">
        発生日
        <Input type="date" value={value.occurredOn} max={todayInJapan()} onChange={(e) => onChange({ ...value, occurredOn: e.target.value })} />
      </label>

      {rating && (
        <fieldset>
          <legend className="mb-2 text-sm font-bold text-text-primary">利用の満足度</legend>
          <StarRatingInput label="利用の満足度" value={rating.value} onChange={rating.onChange} />
          <p className="mt-1 text-xs text-text-secondary">3.0 が標準。評価はクチコミ全体につき 1 つです</p>
        </fieldset>
      )}

      {error && (
        <p className="text-sm text-error" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={submitting || !isReviewEventReady(value)}>
        {submitLabel}
      </Button>
    </form>
  );
}
