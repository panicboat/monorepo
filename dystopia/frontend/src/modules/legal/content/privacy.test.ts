import { describe, expect, it } from "vitest";
import type { LegalSection } from "../types";
import { EDITION, EFFECTIVE_DATE, OPERATOR } from "./operator";
import { PRIVACY } from "./privacy";

const HEADINGS = [
  "運営者と窓口", "取得する情報", "利用目的", "他の利用者に表示される情報", "第三者への提供",
  "委託と外部への送信", "保存場所と安全管理", "Cookie と端末内の保存", "保存期間と削除", "DM とログ",
  "開示などの請求", "18歳未満の方", "改定",
];

const text = (section: LegalSection) =>
  [section.heading, ...section.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? [])])].join("\n");

const section = (number: number) => text(PRIVACY.sections[number - 1]);

const all = [PRIVACY.title, PRIVACY.preamble, ...PRIVACY.sections.map(text)].join("\n");

describe("PRIVACY", () => {
  it("has the 13 sections in order", () => {
    expect(PRIVACY.sections.map((entry) => entry.heading)).toEqual(HEADINGS);
    expect(PRIVACY.title).toBe("プライバシーポリシー");
    expect(PRIVACY.numbering).toBe("section");
    expect(PRIVACY.edition).toBe(EDITION);
    expect(PRIVACY.effectiveDate).toBe(EFFECTIVE_DATE);
  });

  it("names the operator as the contact", () => {
    const contact = section(1);

    expect(contact).toContain(OPERATOR.name);
    expect(contact).toContain(OPERATOR.address);
    expect(contact).toContain(OPERATOR.contact);
  });

  it("lists the phone number and its hash, and says the age answer is not kept", () => {
    const collected = section(2);

    expect(collected).toContain("電話番号");
    expect(collected).toContain("ハッシュ");
    expect(collected).toContain("年齢");
  });

  it("names the processors and the push services abroad", () => {
    const processors = section(6);

    expect(processors).toContain("Amazon Web Services");
    expect(processors).toContain("外国");
    expect(processors).toContain("広告");
  });

  it("keeps data in Tokyo", () => {
    expect(section(7)).toContain("東京");
  });

  it("explains that there is no sign-out", () => {
    expect(section(8)).toContain("ログアウト");
  });

  it("states backup and log periods without a deletion date for deactivated accounts", () => {
    const retention = section(9);

    expect(retention).toMatch(/7\s*日/);
    expect(retention).toMatch(/30\s*日/);

    const deactivation = PRIVACY.sections[8].paragraphs
      .map((paragraph) => [paragraph.text, ...(paragraph.items ?? [])].join("\n"))
      .filter((paragraph) => paragraph.includes("退会"));
    expect(deactivation.length).toBeGreaterThan(0);
    for (const paragraph of deactivation) expect(paragraph).not.toMatch(/30\s*日/);
  });

  it("limits when the operator reads messages", () => {
    expect(section(10)).toContain("申出");
  });

  it("keeps to what the code does", () => {
    expect(all).not.toContain("会員限定");
    expect(all).not.toContain("通報");
    expect(all).not.toContain("出勤");
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
