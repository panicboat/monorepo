import type { ReviewStage } from "../types";

export interface ReviewChoice {
  code: string;
  label: string;
}

export const REVIEW_STAGES: { code: ReviewStage; label: string }[] = [
  { code: "reservation", label: "予約・問い合わせ" },
  { code: "service", label: "利用" },
  { code: "aftercare", label: "利用後" },
];

export const REVIEW_OUTCOMES: Record<ReviewStage, ReviewChoice[]> = {
  reservation: [
    { code: "inquiry_only", label: "問い合わせのみ" },
    { code: "booked", label: "予約成立" },
    { code: "cancelled_by_cast", label: "キャストからキャンセル（連絡あり）" },
    { code: "cast_no_show", label: "キャストの無断キャンセル・不在" },
    { code: "other", label: "その他" },
  ],
  service: [
    { code: "satisfied", label: "満足して終了" },
    { code: "completed_with_issues", label: "不満はあったが終了" },
    { code: "ended_early", label: "途中で終了" },
    { code: "other", label: "その他" },
  ],
  aftercare: [
    { code: "closed_without_issues", label: "問題なく終了" },
    { code: "next_booking_inquiry", label: "次回予約の相談" },
    { code: "inquiry_handled", label: "問い合わせ対応" },
    { code: "trouble_occurred", label: "トラブル発生" },
    { code: "trouble_resolved", label: "トラブル解決" },
    { code: "other", label: "その他" },
  ],
};

export const REVIEW_TAGS: Record<ReviewStage, ReviewChoice[]> = {
  reservation: [
    { code: "quick_reply", label: "返信が早い" },
    { code: "slow_reply", label: "返信が遅い・途絶えた" },
    { code: "clear_conditions", label: "料金・条件の説明が明確" },
    { code: "condition_mismatch", label: "予約条件の認識違い" },
    { code: "rescheduled", label: "日程変更あり" },
    { code: "polite_response", label: "対応が丁寧" },
  ],
  service: [
    { code: "punctual", label: "時間どおり" },
    { code: "late", label: "遅刻あり" },
    { code: "as_pictured", label: "写真・プロフィールどおり" },
    { code: "not_as_pictured", label: "写真・プロフィールと違う" },
    { code: "attentive", label: "接客が丁寧" },
    { code: "unagreed_charge", label: "合意していない料金・要求あり" },
  ],
  aftercare: [
    { code: "polite_contact", label: "丁寧な連絡あり" },
    { code: "excessive_contact", label: "連絡が頻繁・執拗" },
    { code: "condition_change_request", label: "約束と異なる要求" },
    { code: "resolved", label: "問題が解決した" },
  ],
};

const NOTE_REQUIRED_OUTCOMES: Record<ReviewStage, string[]> = {
  reservation: ["cast_no_show"],
  service: ["ended_early"],
  aftercare: ["trouble_occurred"],
};

export const MAX_NOTE_LENGTH = 500;

export function isNoteRequired(stage: ReviewStage, outcome: string): boolean {
  return NOTE_REQUIRED_OUTCOMES[stage].includes(outcome);
}

export function stageLabel(stage: ReviewStage): string {
  return REVIEW_STAGES.find((choice) => choice.code === stage)?.label ?? stage;
}

// A code dropped from the catalog may still sit in older events, so show the code instead of failing.
export function outcomeLabel(stage: ReviewStage, code: string): string {
  return REVIEW_OUTCOMES[stage].find((choice) => choice.code === code)?.label ?? code;
}

export function tagLabel(stage: ReviewStage, code: string): string {
  return REVIEW_TAGS[stage].find((choice) => choice.code === code)?.label ?? code;
}
