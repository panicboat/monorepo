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

const dialog = () => document.querySelector('[role="dialog"]');
const buttonNamed = (name: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === name) as HTMLButtonElement;

async function fill(id: string, value: string) {
  const input = document.getElementById(id) as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submitCredentials() {
  await fill("phone", "09012345678");
  await fill("password", "correct-horse-battery");
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
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("SignupPage age check", () => {
  it("asks whether the visitor is 18 or over before the form can be sent", async () => {
    expect(dialog()?.textContent).toContain("あなたは18歳以上ですか？");

    await submitCredentials();

    expect(auth.register).not.toHaveBeenCalled();
  });

  it("opens the form once the visitor answers yes", async () => {
    await act(async () => buttonNamed("はい（18歳以上です）").click());

    expect(dialog()).toBeNull();
    await act(async () => (document.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    await submitCredentials();
    expect(auth.register).toHaveBeenCalledWith("09012345678", "correct-horse-battery");
  });

  it("keeps the form closed and says why when the visitor answers no", async () => {
    await act(async () => buttonNamed("いいえ").click());

    expect(dialog()?.textContent).toContain("18歳未満の方はご利用いただけません。");
    expect(buttonNamed("はい（18歳以上です）")).toBeUndefined();
    await submitCredentials();
    expect(auth.register).not.toHaveBeenCalled();
  });

  it("stays open on Escape", async () => {
    await act(async () => {
      document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    });

    expect(dialog()).not.toBeNull();
  });
});
