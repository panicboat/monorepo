import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("renders the age-gate CTA linking to /signup", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('href="/signup"');
    expect(html).toContain("18歳以上なので入室します");
  });

  it("renders the exit link pointing to an external site", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('href="https://www.google.com"');
  });

  it("renders a login link for existing users", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain('href="/login"');
  });
});
