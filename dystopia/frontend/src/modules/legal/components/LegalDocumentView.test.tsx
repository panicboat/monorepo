import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LegalDocument } from "../types";
import { LegalDocumentView } from "./LegalDocumentView";

const fixture: LegalDocument = {
  title: "テスト規約",
  edition: "第1版",
  effectiveDate: "【施行日】",
  numbering: "article",
  preamble: "前文です。",
  sections: [
    { heading: "目的", paragraphs: [{ text: "一つだけの段落。" }] },
    {
      heading: "定義",
      paragraphs: [{ text: "最初の段落。", items: ["一号", "二号"] }, { text: "次の段落。" }],
    },
  ],
};

const related = { href: "/privacy", label: "プライバシーポリシー" };

const render = (document: LegalDocument = fixture) =>
  renderToStaticMarkup(<LegalDocumentView document={document} related={related} />);

describe("LegalDocumentView", () => {
  it("shows the title, edition and effective date", () => {
    const html = render();

    expect(html).toMatch(/<h1[^>]*>テスト規約<\/h1>/);
    expect(html).toContain("第1版");
    expect(html).toContain("【施行日】施行");
  });

  it("numbers articles and links each one from the table of contents", () => {
    const html = render();

    expect(html).toContain("第1条（目的）");
    expect(html).toContain("第2条（定義）");
    expect(html).toContain('href="#article-2"');
    expect(html).toContain('id="article-2"');
    expect(html).toContain('aria-label="目次"');
  });

  it("numbers paragraphs only when an article has more than one", () => {
    const html = render();

    expect(html).toMatch(/2\.(<[^>]*>|\s)*次の段落。/);
    expect(html).toMatch(/1\.(<[^>]*>|\s)*最初の段落。/);
    expect(html).not.toMatch(/1\.(<[^>]*>|\s)*一つだけの段落。/);
  });

  it("marks items with full-width parentheses", () => {
    const html = render();

    expect(html).toMatch(/（1）(<[^>]*>|\s)*一号/);
    expect(html).toMatch(/（2）(<[^>]*>|\s)*二号/);
  });

  it("numbers privacy sections without the article form", () => {
    const html = render({ ...fixture, numbering: "section" });

    expect(html).toContain("1. 目的");
    expect(html).toContain("2. 定義");
    expect(html).not.toContain("第1条");
    expect(html).toContain('id="section-1"');
    expect(html).not.toMatch(/1\.(<[^>]*>|\s)*最初の段落。/);
    expect(html).not.toMatch(/2\.(<[^>]*>|\s)*次の段落。/);
  });

  it("links to the related document and back to the home page", () => {
    const html = render();

    expect(html).toMatch(/<a[^>]*href="\/privacy"[^>]*>プライバシーポリシー<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>dystopia\.city<\/a>/);
  });
});
