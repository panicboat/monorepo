import { describe, expect, it } from "vitest";
import type { LegalSection } from "../types";
import { EDITION, EFFECTIVE_DATE, OPERATOR, OPERATOR_IDENTITY_ON_REQUEST } from "./operator";
import { TERMS } from "./terms";

const HEADINGS = [
  "目的と適用", "定義", "利用資格", "登録", "アカウントの管理", "プロフィール", "投稿等の責任と権利",
  "売春・裏引き・店舗外の取引の禁止", "個人情報の書き込みと晒しの禁止", "カルテ", "クチコミ",
  "DM", "禁止事項", "違反への措置", "権利侵害の申出", "退会",
  "サービスの変更・中断・終了", "個人情報の取扱い", "免責", "知的財産権と外部リンク", "通知・連絡", "規約の変更",
  "有料機能", "分離可能性", "準拠法と管轄", "運営者",
];

const text = (section: LegalSection) =>
  [section.heading, ...section.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? [])])].join("\n");

const article = (heading: string) => text(TERMS.sections.find((entry) => entry.heading === heading)!);

const all = [TERMS.title, TERMS.preamble, ...TERMS.sections.map(text)].join("\n");

describe("TERMS", () => {
  it("has the articles in order", () => {
    expect(TERMS.sections.map((entry) => entry.heading)).toEqual(HEADINGS);
    expect(TERMS.title).toBe("利用規約");
    expect(TERMS.numbering).toBe("article");
    expect(TERMS.edition).toBe(EDITION);
    expect(TERMS.effectiveDate).toBe(EFFECTIVE_DATE);
  });

  it("names the contact and answers the operator's identity on request", () => {
    expect(article("運営者")).toContain(OPERATOR.contact);
    expect(article("運営者")).toContain(OPERATOR_IDENTITY_ON_REQUEST);
    expect(OPERATOR.contact).toBe("support@dystopia.city");
    expect(all).not.toContain("【連絡先】");
    expect(all).not.toContain("【運営者氏名】");
    expect(all).not.toContain("【住所】");
  });

  it("limits use to people aged 18 or over who are not high school students", () => {
    expect(article("利用資格")).toContain("本サービスを利用できるのは、18歳以上の方に限ります。18歳以上であっても、高校生の方は利用できません。");
  });

  it("shows the karte to casts only", () => {
    expect(article("カルテ")).toContain("カルテは、キャストの間で共有されます。ゲストは、自分についてのカルテも見ることができません。");
  });

  it("lets the operator read DMs only on requests and under the law, with the user's consent", () => {
    expect(article("DM")).toContain("運営者は、利用者その他の方からの申出に対応する場合と、法令にもとづく場合に限り、DM の内容を確認します。利用者は、運営者がこれらの場合に DM の内容を確認することに同意します。");
  });

  it("leaves what remains after deactivation to the privacy policy", () => {
    expect(article("退会")).toContain("退会した後も残る情報は、プライバシーポリシーの「保存期間と削除」の節に定めます。");
  });

  it("leaves out implementation values and words the app does not use", () => {
    expect(all.replace("1か月前", "")).not.toMatch(/[0-9０-９一二三四五六七八九十百千]+\s*(?:日|時間|字|週間|か月|ヶ月|カ月|年|件|回|枚)/);
    for (const word of ["出勤", "通報", "メモ", "非表示", "個別のお知らせ", "別に定めるルール"]) {
      expect(all).not.toContain(word);
    }
  });

  it("leaves out how features behave, so that a feature change does not change the text", () => {
    for (const word of ["鍵", "承認制", "公開範囲", "ログアウト"]) {
      expect(all).not.toContain(word);
    }
  });

  it("leaves the numbering of paragraphs and items to the view", () => {
    for (const section of TERMS.sections) {
      expect(section.heading).not.toMatch(/^第\d+条/);
      for (const paragraph of section.paragraphs) {
        expect(paragraph.text).not.toMatch(/^(?:\d+\.|（\d+）)/);
        if (paragraph.items) {
          expect(paragraph.items.length).toBeGreaterThan(0);
          for (const item of paragraph.items) expect(item).not.toMatch(/^(?:\d+\.|（\d+）)/);
        }
      }
    }
  });
});
