import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const navigation = vi.hoisted(() => ({ role: null as string | null }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => (navigation.role === null ? null : new URLSearchParams({ role: navigation.role })),
}));

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

  it("starts with the role chosen on the landing page", () => {
    const checkedRole = (html: string) =>
      (html.match(/<input[^>]*name="role"[^>]*>/g) ?? []).find((input) => input.includes("checked"))?.match(/value="(\d)"/)?.[1];

    navigation.role = "cast";
    const asCast = renderToStaticMarkup(<SignupPage />);
    navigation.role = "guest";
    const asGuest = renderToStaticMarkup(<SignupPage />);
    navigation.role = null;
    const withoutChoice = renderToStaticMarkup(<SignupPage />);

    expect([checkedRole(asCast), checkedRole(asGuest), checkedRole(withoutChoice)]).toEqual(["2", "1", "1"]);
  });
});
