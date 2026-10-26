// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { ProfileNameForm } = await import("./ProfileNameForm");

afterEach(() => {
  document.body.innerHTML = "";
});

async function fillAndSubmit(displayName: string, username: string) {
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  for (const [id, value] of [["displayName", displayName], ["username", username]]) {
    const input = document.querySelector(`#${id}`) as HTMLInputElement;
    await act(async () => {
      setValue?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  await act(async () => {
    document.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

async function renderForm(onSubmit: () => Promise<void>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(ProfileNameForm, { submitLabel: "保存", onSubmit }));
  });
}

describe("ProfileNameForm", () => {
  it("submits a display name with a visible character", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await renderForm(onSubmit);

    await fillAndSubmit("さくら", "sakura");

    expect(onSubmit).toHaveBeenCalledWith({ displayName: "さくら", username: "sakura" });
  });

  it("does not submit a display name of only full-width spaces", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    await renderForm(onSubmit);

    await fillAndSubmit("　", "sakura");

    expect(onSubmit).not.toHaveBeenCalled();
    expect(document.querySelector('form [role="alert"]')?.textContent).toBe("表示名を入力してください");
  });
});
