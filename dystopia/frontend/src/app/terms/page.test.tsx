import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TermsPage, { metadata } from "./page";

describe("TermsPage", () => {
  it("renders the terms with a link to the privacy policy", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toMatch(/<h1[^>]*>利用規約<\/h1>/);
    expect(html).toContain("第1条（目的と適用）");
    expect(html).toContain('href="/privacy"');
  });

  it("sets the page title", () => {
    expect(metadata.title).toBe("利用規約 | dystopia.city");
  });
});
