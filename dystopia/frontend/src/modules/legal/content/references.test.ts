import { describe, expect, it } from "vitest";
import type { LegalDocument } from "../types";
import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";

const REFERENCE = /(利用規約)?((?:前項|第\d+[条項号節])(?:(?:と|および|または|から|、)?第\d+[条項号節])*)/g;
const PART = /前項|第(\d+)([条項号節])/g;

interface Reference {
  label: string;
  resolved: boolean;
}

const exists = (document: LegalDocument, section?: number, paragraph?: number, item?: number) => {
  const target = section === undefined ? undefined : document.sections[section - 1];
  if (!target) return false;
  if (paragraph === undefined) return true;
  const entry = target.paragraphs[paragraph - 1];
  if (!entry) return false;
  return item === undefined || entry.items?.[item - 1] !== undefined;
};

const sectionName = (document: LegalDocument, number: number) =>
  document.numbering === "article" ? `第${number}条` : `第${number}節`;

function references(document: LegalDocument): Reference[] {
  return document.sections.flatMap((source, sectionIndex) =>
    source.paragraphs.flatMap((paragraph, paragraphIndex) =>
      [paragraph.text, ...(paragraph.items ?? [])].flatMap((text) =>
        Array.from(text.matchAll(REFERENCE), ([reference, terms, chain]) => {
          const target = terms ? TERMS : document;
          let section = terms ? undefined : sectionIndex + 1;
          let paragraphNumber = terms ? undefined : paragraphIndex + 1;
          const resolved = Array.from(chain.matchAll(PART), ([part, digits, unit]) => {
            const number = Number(digits);
            if (part === "前項") {
              section = sectionIndex + 1;
              paragraphNumber = paragraphIndex;
              return target.numbering === "article" && exists(target, section, paragraphNumber);
            }
            if (unit === "条" || unit === "節") {
              section = number;
              paragraphNumber = undefined;
              return target.numbering === (unit === "条" ? "article" : "section") && exists(target, section);
            }
            if (unit === "項") {
              paragraphNumber = number;
              return target.numbering === "article" && exists(target, section, paragraphNumber);
            }
            return target.numbering === "article" && paragraphNumber !== undefined && exists(target, section, paragraphNumber, number);
          }).every(Boolean);
          return { label: `${document.title} ${sectionName(document, sectionIndex + 1)}: ${reference}`, resolved };
        }),
      ),
    ),
  );
}

const all = [...references(TERMS), ...references(PRIVACY)];

const NAME_REFERENCE = /(?:(利用規約|プライバシーポリシー)の)?「([^「」]+)」の(条|節)/g;

const hasHeading = (document: LegalDocument, heading: string) => document.sections.some((section) => section.heading === heading);

function nameReferences(
  source: LegalDocument,
  documents: { terms: LegalDocument; privacy: LegalDocument },
): { label: string; resolved: boolean }[] {
  const resolve = (name: string | undefined, heading: string, unit: string) => {
    if (name === "利用規約") return unit === "条" && hasHeading(documents.terms, heading);
    if (name === "プライバシーポリシー") return unit === "節" && hasHeading(documents.privacy, heading);
    return source.numbering === (unit === "条" ? "article" : "section") && hasHeading(source, heading);
  };

  return source.sections.flatMap((section) =>
    section.paragraphs.flatMap((paragraph) =>
      [paragraph.text, ...(paragraph.items ?? [])].flatMap((text) =>
        Array.from(text.matchAll(NAME_REFERENCE), ([reference, name, heading, unit]) => ({
          label: `${source.title} ${section.heading}: ${reference}`,
          resolved: resolve(name, heading, unit),
        })),
      ),
    ),
  );
}

describe("cross-references in the terms and the privacy policy", () => {
  it("finds the references of every form", () => {
    expect(all.map((reference) => reference.label)).toEqual(
      expect.arrayContaining([
        "利用規約 第2条: 第27条",
        "利用規約 第2条: 第14条第4項",
        "利用規約 第9条: 前項第2号",
        "利用規約 第9条: 第10条と第11条",
        "利用規約 第13条: 第8条第2項",
        "利用規約 第15条: 前項第7号から第10号",
        "利用規約 第18条: 第5項から第7項",
        "プライバシーポリシー 第1節: 第11節",
        "プライバシーポリシー 第9節: 利用規約第18条第2項",
        "プライバシーポリシー 第11節: 利用規約第10条第5項および第11条第5項",
      ]),
    );
  });

  it("points every reference at an existing article, paragraph, item or section", () => {
    expect(all.filter((reference) => !reference.resolved).map((reference) => reference.label)).toEqual([]);
  });
});

const fixture = (title: string, numbering: LegalDocument["numbering"], sections: LegalDocument["sections"]): LegalDocument => ({
  title, edition: "第1版", effectiveDate: "【施行日】", numbering, preamble: "", sections,
});

describe("name references", () => {
  it("resolves a reference by heading and rejects a missing heading or the wrong document", () => {
    const terms = fixture("利用規約", "article", [
      { heading: "退会", paragraphs: [{ text: "残る情報は、プライバシーポリシーの「保存期間と削除」の節に定めます。" }] },
      { heading: "利用資格", paragraphs: [{ text: "退会した場合と同じです（「退会」の条）。「存在しない」の条も見ます。「保存期間と削除」の節も見ます。" }] },
    ]);
    const privacy = fixture("プライバシーポリシー", "section", [
      { heading: "保存期間と削除", paragraphs: [{ text: "利用規約の「退会」の条に定めるとおりです。" }] },
    ]);
    const documents = { terms, privacy };

    expect(nameReferences(terms, documents)).toEqual([
      { label: "利用規約 退会: プライバシーポリシーの「保存期間と削除」の節", resolved: true },
      { label: "利用規約 利用資格: 「退会」の条", resolved: true },
      { label: "利用規約 利用資格: 「存在しない」の条", resolved: false },
      { label: "利用規約 利用資格: 「保存期間と削除」の節", resolved: false },
    ]);
    expect(nameReferences(privacy, documents)).toEqual([
      { label: "プライバシーポリシー 保存期間と削除: 利用規約の「退会」の条", resolved: true },
    ]);
  });

  it("points every name reference in the terms and the privacy policy at an existing heading", () => {
    const documents = { terms: TERMS, privacy: PRIVACY };
    const unresolved = [...nameReferences(TERMS, documents), ...nameReferences(PRIVACY, documents)].filter((reference) => !reference.resolved);

    expect(unresolved.map((reference) => reference.label)).toEqual([]);
  });
});
