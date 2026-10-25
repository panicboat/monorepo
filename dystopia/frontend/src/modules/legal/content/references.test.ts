import { describe, expect, it } from "vitest";
import type { LegalDocument } from "../types";
import { PRIVACY } from "./privacy";
import { TERMS } from "./terms";

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
  it("refers to articles and sections by heading, not by number", () => {
    const NUMBER = /前項|次項|第[0-9０-９一二三四五六七八九十]+[条項号節]/;
    const texts = [TERMS, PRIVACY].flatMap((document) =>
      document.sections.flatMap((section) => section.paragraphs.flatMap((paragraph) => [paragraph.text, ...(paragraph.items ?? [])])),
    );

    expect(texts.filter((text) => NUMBER.test(text))).toEqual([]);
  });
});

const fixture = (title: string, numbering: LegalDocument["numbering"], sections: LegalDocument["sections"]): LegalDocument => ({
  title, edition: "第1版", effectiveDate: "【施行日】", numbering, preamble: "", sections,
});

describe("name references", () => {
  it("resolves a reference by heading and rejects a missing heading or the wrong document", () => {
    const terms = fixture("利用規約", "article", [
      { heading: "退会", paragraphs: [{ text: "残る情報は、プライバシーポリシーの「保存期間と削除」の節に定めます。" }] },
      { heading: "利用資格", paragraphs: [{ text: "退会した場合と同じです（「退会」の条）。「存在しない」の条も見ます。「保存期間と削除」の節も見ます。「退会」の節と利用規約の「退会」の節も見ます。" }] },
    ]);
    const privacy = fixture("プライバシーポリシー", "section", [
      {
        heading: "保存期間と削除",
        paragraphs: [
          { text: "利用規約の「退会」の条に定めるとおりです。" },
          { text: "プライバシーポリシーの「保存期間と削除」の条も見ます。", items: ["「保存期間と削除」の節"] },
        ],
      },
    ]);
    const documents = { terms, privacy };

    expect(nameReferences(terms, documents)).toEqual([
      { label: "利用規約 退会: プライバシーポリシーの「保存期間と削除」の節", resolved: true },
      { label: "利用規約 利用資格: 「退会」の条", resolved: true },
      { label: "利用規約 利用資格: 「存在しない」の条", resolved: false },
      { label: "利用規約 利用資格: 「保存期間と削除」の節", resolved: false },
      { label: "利用規約 利用資格: 「退会」の節", resolved: false },
      { label: "利用規約 利用資格: 利用規約の「退会」の節", resolved: false },
    ]);
    expect(nameReferences(privacy, documents)).toEqual([
      { label: "プライバシーポリシー 保存期間と削除: 利用規約の「退会」の条", resolved: true },
      { label: "プライバシーポリシー 保存期間と削除: プライバシーポリシーの「保存期間と削除」の条", resolved: false },
      { label: "プライバシーポリシー 保存期間と削除: 「保存期間と削除」の節", resolved: true },
    ]);
  });

  it("points every name reference in the terms and the privacy policy at an existing heading", () => {
    const documents = { terms: TERMS, privacy: PRIVACY };
    const unresolved = [...nameReferences(TERMS, documents), ...nameReferences(PRIVACY, documents)].filter((reference) => !reference.resolved);

    expect(unresolved.map((reference) => reference.label)).toEqual([]);
  });
});
