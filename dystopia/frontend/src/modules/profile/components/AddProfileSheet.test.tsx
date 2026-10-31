// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/settings" }));

const { AddProfileSheet } = await import("./AddProfileSheet");

afterEach(() => {
  document.body.innerHTML = "";
});

describe("AddProfileSheet", () => {
  it("explains what it adds and submits the name form", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(AddProfileSheet, { open: true, onClose: vi.fn(), onSubmit }));
    });

    expect(document.body.textContent).toContain("プロフィールを追加");
    expect(document.body.textContent).toContain("別の名前で使うプロフィールを追加できます。");
    expect(document.querySelector('[role="dialog"] form')).not.toBeNull();
  });

  async function fillAndSubmit() {
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    for (const [id, value] of [["displayName", "Fourth"], ["username", "fourth"]]) {
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

  it("shows why a profile could not be added", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("プロフィールをこれ以上追加できません"));
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(AddProfileSheet, { open: true, onClose: vi.fn(), onSubmit }));
    });

    await fillAndSubmit();

    expect(document.querySelector('form [role="alert"]')?.textContent).toBe("プロフィールをこれ以上追加できません");
  });

  it("closes without creating anything when cancelled", async () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(AddProfileSheet, { open: true, onClose, onSubmit }));
    });

    const cancel = Array.from(document.querySelectorAll("form button")).find((button) => button.textContent === "キャンセル");
    await act(async () => {
      (cancel as HTMLButtonElement).click();
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not let the form be cancelled while the profile is being created", async () => {
    let finish: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(createElement(AddProfileSheet, { open: true, onClose: vi.fn(), onSubmit }));
    });

    await fillAndSubmit();
    const cancel = Array.from(document.querySelectorAll("form button")).find((button) => button.textContent === "キャンセル");

    expect((cancel as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      finish();
    });
  });
});
