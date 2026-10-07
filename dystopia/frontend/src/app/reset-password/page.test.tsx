// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authMocks = vi.hoisted(() => ({
  forgotPassword: vi.fn(),
  confirmForgotPassword: vi.fn(),
}));

vi.mock("@/modules/identity/hooks/useAuth", () => ({
  useAuth: () => authMocks,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const { default: ResetPasswordPage } = await import("./page");

async function renderCodeStep() {
  authMocks.forgotPassword.mockResolvedValue(undefined);

  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<ResetPasswordPage />);
  });
  await act(async () => {
    container
      .querySelector("form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });

  return container;
}

describe("ResetPasswordPage", () => {
  it("shows the password requirements next to the new password field", async () => {
    const container = await renderCodeStep();

    expect(container.querySelector("#new-password")).not.toBeNull();
    expect(container.textContent).toContain("12 文字以上");
  });

  it("links the new password input to the requirements for assistive technology", async () => {
    const container = await renderCodeStep();
    const describedBy = container
      .querySelector("#new-password")!
      .getAttribute("aria-describedby");

    expect(describedBy).not.toBeNull();
    expect(container.querySelector(`#${describedBy}`)?.textContent).toContain("12 文字以上");
  });
});
