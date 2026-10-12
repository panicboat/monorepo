import type { KarteStage } from "../types";

export const eventCatalog = {
  booking: {
    label: "予約・問い合わせ",
    outcomes: { inquiry: "問い合わせのみ", confirmed: "予約成立", cancelled_contacted: "キャンセル（連絡あり）", no_show: "無断キャンセル・来店なし", other: "その他" },
    tags: { smooth_contact: "連絡が円滑", contact_issue: "返信・連絡に問題あり", terms_mismatch: "予約条件の認識違い", date_change: "日程変更", advance_notice: "事前連絡あり", unagreed_request: "合意していない要求あり" },
    noteOutcomes: ["no_show"],
    noteTags: ["unagreed_request"],
  },
  service: {
    label: "接客",
    outcomes: { completed: "問題なく完了", completed_with_issues: "問題はあったが完了", ended_early: "途中終了", other: "その他" },
    tags: { on_time: "時間遵守", late: "遅刻あり", payment_ok: "支払いに問題なし", payment_trouble: "支払いトラブルあり", smooth_communication: "コミュニケーションが円滑", beyond_agreement: "合意条件を超える要求あり" },
    noteOutcomes: ["ended_early"],
    noteTags: ["payment_trouble", "beyond_agreement"],
  },
  after_service: {
    label: "接客後",
    outcomes: { completed: "問題なく対応終了", next_booking: "次回予約の相談", inquiry: "問い合わせ対応", trouble: "トラブル発生", resolved: "トラブル解決", other: "その他" },
    tags: { polite_contact: "丁寧な連絡あり", persistent_contact: "連絡が頻繁・執拗", personal_contact_request: "個人的な連絡先の要求", terms_mismatch: "約束した条件と異なる要求", resolved: "問題が解決した" },
    noteOutcomes: ["trouble"],
    noteTags: ["terms_mismatch"],
  },
} satisfies Record<KarteStage, { label: string; outcomes: Record<string, string>; tags: Record<string, string>; noteOutcomes: string[]; noteTags: string[] }>;

export const karteStages: KarteStage[] = ["booking", "service", "after_service"];
