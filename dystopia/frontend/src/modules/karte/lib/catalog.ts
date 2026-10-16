import type { KarteStage } from "../types";

export interface KarteChoice {
  code: string;
  label: string;
}

export const KARTE_STAGES: { code: KarteStage; label: string }[] = [
  { code: "reservation", label: "予約・問い合わせ" },
  { code: "service", label: "接客" },
  { code: "aftercare", label: "接客後" },
];

export const KARTE_OUTCOMES: Record<KarteStage, KarteChoice[]> = {
  reservation: [
    { code: "inquiry_only", label: "問い合わせのみ" },
    { code: "booked", label: "予約成立" },
    { code: "cancelled_with_notice", label: "キャンセル（連絡あり）" },
    { code: "no_show", label: "無断キャンセル・来店なし" },
    { code: "other", label: "その他" },
  ],
  service: [
    { code: "completed", label: "問題なく完了" },
    { code: "completed_with_issues", label: "問題はあったが完了" },
    { code: "ended_early", label: "途中終了" },
    { code: "other", label: "その他" },
  ],
  aftercare: [
    { code: "closed_without_issues", label: "問題なく対応終了" },
    { code: "next_booking_inquiry", label: "次回予約の相談" },
    { code: "inquiry_handled", label: "問い合わせ対応" },
    { code: "trouble_occurred", label: "トラブル発生" },
    { code: "trouble_resolved", label: "トラブル解決" },
    { code: "other", label: "その他" },
  ],
};

export const KARTE_TAGS: Record<KarteStage, KarteChoice[]> = {
  reservation: [
    { code: "smooth_contact", label: "連絡が円滑" },
    { code: "contact_problem", label: "返信・連絡に問題あり" },
    { code: "condition_mismatch", label: "予約条件の認識違い" },
    { code: "rescheduled", label: "日程変更" },
    { code: "advance_notice", label: "事前連絡あり" },
    { code: "unagreed_request", label: "合意していない要求あり" },
  ],
  service: [
    { code: "punctual", label: "時間遵守" },
    { code: "late", label: "遅刻あり" },
    { code: "payment_ok", label: "支払いに問題なし" },
    { code: "payment_trouble", label: "支払いトラブルあり" },
    { code: "smooth_communication", label: "コミュニケーションが円滑" },
    { code: "excessive_request", label: "合意条件を超える要求あり" },
  ],
  aftercare: [
    { code: "polite_contact", label: "丁寧な連絡あり" },
    { code: "excessive_contact", label: "連絡が頻繁・執拗" },
    { code: "personal_contact_request", label: "個人的な連絡先の要求" },
    { code: "condition_change_request", label: "約束した条件と異なる要求" },
    { code: "resolved", label: "問題が解決した" },
  ],
};

const NOTE_REQUIRED_OUTCOMES: Record<KarteStage, string[]> = {
  reservation: ["no_show"],
  service: ["ended_early"],
  aftercare: ["trouble_occurred"],
};

export const MAX_NOTE_LENGTH = 500;

export function isNoteRequired(stage: KarteStage, outcome: string): boolean {
  return NOTE_REQUIRED_OUTCOMES[stage].includes(outcome);
}

export function stageLabel(stage: KarteStage): string {
  return KARTE_STAGES.find((choice) => choice.code === stage)?.label ?? stage;
}

// A code dropped from the catalog may still sit in older events, so show the code instead of failing.
export function outcomeLabel(stage: KarteStage, code: string): string {
  return KARTE_OUTCOMES[stage].find((choice) => choice.code === code)?.label ?? code;
}

export function tagLabel(stage: KarteStage, code: string): string {
  return KARTE_TAGS[stage].find((choice) => choice.code === code)?.label ?? code;
}
