import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/identity/hooks/useAuth", () => ({
  useAuth: () => ({ register: vi.fn(), verify: vi.fn() }),
}));

const { default: SignupPage } = await import("./page");

describe("SignupPage", () => {
  it("shows the password requirements before the form is submitted", () => {
    const html = renderToStaticMarkup(<SignupPage />);

    expect(html).toContain("12 文字以上");
  });

  it("links the password input to the requirements for assistive technology", () => {
    const html = renderToStaticMarkup(<SignupPage />);
    const passwordInput = html.match(/<input[^>]*id="password"[^>]*>/)?.[0] ?? "";
    const describedBy = passwordInput.match(/aria-describedby="([^"]+)"/)?.[1];

    expect(describedBy).toBeDefined();
    expect(html).toMatch(new RegExp(`<p[^>]*id="${describedBy}"[^>]*>[^<]*12 文字以上`));
  });
});
