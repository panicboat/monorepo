import { describe, expect, it } from "vitest";
import type { LegalSection } from "../types";
import { EDITION, EFFECTIVE_DATE, OPERATOR, OPERATOR_IDENTITY_ON_REQUEST } from "./operator";
import { PRIVACY } from "./privacy";

const HEADINGS = [
  "運営者と窓口", "取得する情報", "利用目的", "他の利用者に表示される情報", "カルテ・クチコミ・足跡の共有",
  "第三者への提供", "外部のサービスの利用と外部への送信", "保存場所と安全管理", "Cookie と端末内の保存", "保存期間と削除",
  "DM とログ", "開示などの請求", "18歳未満の方", "改定",
];

const text = (section: LegalSection) =>
  [section.heading, ...section.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? [])])].join("\n");

const section = (heading: string) => text(PRIVACY.sections.find((entry) => entry.heading === heading)!);

const all = [PRIVACY.title, PRIVACY.preamble, ...PRIVACY.sections.map(text)].join("\n");

describe("PRIVACY", () => {
  it("has the sections in order", () => {
    expect(PRIVACY.sections.map((entry) => entry.heading)).toEqual(HEADINGS);
    expect(PRIVACY.title).toBe("プライバシーポリシー");
    expect(PRIVACY.numbering).toBe("section");
    expect(PRIVACY.edition).toBe(EDITION);
    expect(PRIVACY.effectiveDate).toBe(EFFECTIVE_DATE);
  });

  it("names the contact and answers the operator's identity on request", () => {
    expect(section("運営者と窓口")).toContain(OPERATOR.contact);
    expect(section("運営者と窓口")).toContain(OPERATOR_IDENTITY_ON_REQUEST);
    expect(all).not.toContain("【運営者氏名】");
    expect(all).not.toContain("【住所】");
  });

  it("keeps the phone number and the password out of the database", () => {
    expect(section("取得する情報")).toContain("電話番号、ハッシュ値、パスワードおよびパスワードを確認するための情報は、いずれも、本サービスのデータベースには保存しません。");
  });

  it("shows the karte to every cast and not to the guest it is about", () => {
    expect(section("カルテ・クチコミ・足跡の共有")).toContain("カルテの内容（評価、段階、結果、タグ、補足および日付）、書いたキャストと対象のゲストのプロフィールの情報、および対象のゲストについてのカルテの評価の集計は、すべてのキャストに表示されます。");
    expect(section("カルテ・クチコミ・足跡の共有")).toContain("ゲストには、本サービス上では、自分についてのカルテも表示されません。");
  });

  it("lets the operator read DMs only in the cases the terms set", () => {
    expect(section("DM とログ")).toContain("運営者が DM の内容を確認するのは、利用規約の「DM」の条に定める場合に限ります。");
  });

  it("keeps the karte, delivered DMs and reviews after deactivation and deletions", () => {
    const remaining = PRIVACY.sections.find((entry) => entry.heading === "保存期間と削除")!.paragraphs.find((paragraph) => paragraph.text.includes("次の情報は残ります"));

    expect(remaining?.text).toBe("利用者が退会し、プロフィールを削除し、または運営者が利用者のアカウントを削除した場合（「18歳未満の方」の節の場合と、利用規約の「違反への措置」の条の場合）も、その利用者またはそのプロフィールに関係する次の情報は残ります。この場合、その利用者またはそのプロフィールの表示名、ユーザー名、アバターなどの情報は、表示されなくなります。");
    expect(remaining?.items).toEqual([
      "カルテ",
      "相手に届いた DM",
      "クチコミ（クチコミの評価は、対象のキャストの評価の集計に含まれたままです）",
    ]);
  });

  it("does not use ad or analytics tools", () => {
    expect(all).toContain("運営者は、広告を配信するツールと、アクセスを解析するツールを使っていません。");
  });

  it("leaves out implementation values, setting and infrastructure names, and words the app does not use", () => {
    expect(all).not.toMatch(/[0-9０-９]+\s*(?:日|時間|字)/);
    for (const word of ["出勤", "通報", "メモ", "非表示", "個別のお知らせ", "この端末で受け取る", "他人のプロフィール訪問時に足跡を残す", "localStorage", "AWS", "Amazon", "東京リージョン"]) {
      expect(all).not.toContain(word);
    }
  });

  it("leaves the numbering of headings and items to the view", () => {
    for (const entry of PRIVACY.sections) {
      expect(entry.heading).not.toMatch(/^\d+\./);
      for (const paragraph of entry.paragraphs) {
        expect(paragraph.text).not.toMatch(/^(?:\d+\.|（\d+）)/);
        if (paragraph.items) {
          expect(paragraph.items.length).toBeGreaterThan(0);
          for (const item of paragraph.items) expect(item).not.toMatch(/^(?:\d+\.|（\d+）)/);
        }
      }
    }
  });
});
