import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import PrivacyPage, { metadata } from "./page";

describe("PrivacyPage", () => {
  it("renders the policy with a link to the terms", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toMatch(/<h1[^>]*>プライバシーポリシー<\/h1>/);
    expect(html).toContain("1. 運営者と窓口");
    expect(html).toContain('href="/terms"');
  });

  it("sets the page title", () => {
    expect(metadata.title).toBe("プライバシーポリシー | dystopia.city");
  });
});
