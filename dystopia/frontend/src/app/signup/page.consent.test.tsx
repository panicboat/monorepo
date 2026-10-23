// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const auth = vi.hoisted(() => ({ register: vi.fn(), verify: vi.fn() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => null }));
vi.mock("@/modules/identity/hooks/useAuth", () => ({ useAuth: () => auth }));

const { default: SignupPage } = await import("./page");

let root: Root;
let container: HTMLElement;

const buttonNamed = (name: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === name) as HTMLButtonElement;
const consentCheckbox = () => document.querySelector('input[type="checkbox"]') as HTMLInputElement;

async function fill(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function fillCredentials() {
  await fill("phone", "09012345678");
  await fill("password", "correct-horse-battery");
}

async function requestSubmit() {
  await act(async () => {
    (document.querySelector("form") as HTMLFormElement).requestSubmit();
  });
}

beforeEach(async () => {
  auth.register.mockReset().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(SignupPage)));
  await act(async () => buttonNamed("はい（18歳以上です）").click());
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SignupPage consent", () => {
  it("keeps the SMS button off until the visitor agrees", async () => {
    await fillCredentials();

    expect(buttonNamed("SMS を送信").disabled).toBe(true);
    await requestSubmit();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("sends the SMS once the visitor agrees", async () => {
    await fillCredentials();
    await act(async () => consentCheckbox().click());

    expect(buttonNamed("SMS を送信").disabled).toBe(false);
    await requestSubmit();
    expect(auth.register).toHaveBeenCalledWith("09012345678", "correct-horse-battery");
  });

  it("opens the terms and the privacy policy in a new tab", () => {
    const terms = document.querySelector('a[href="/terms"]') as HTMLAnchorElement;
    const privacy = document.querySelector('a[href="/privacy"]') as HTMLAnchorElement;

    expect(terms.textContent).toBe("利用規約");
    expect(terms.getAttribute("target")).toBe("_blank");
    expect(terms.getAttribute("rel")).toBe("noopener noreferrer");
    expect(privacy.textContent).toBe("プライバシーポリシー");
    expect(privacy.getAttribute("target")).toBe("_blank");
    expect(privacy.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps the agreement after going back from the code step", async () => {
    await fillCredentials();
    await act(async () => consentCheckbox().click());
    await requestSubmit();
    expect(document.getElementById("code")).not.toBeNull();

    await act(async () => buttonNamed("入力内容を変更").click());

    expect(consentCheckbox().checked).toBe(true);
    expect(buttonNamed("SMS を送信").disabled).toBe(false);
  });
});
