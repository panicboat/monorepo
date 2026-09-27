// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MessageComposer } from "./MessageComposer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function flush() {
  return act(async () => {
    await Promise.resolve();
  });
}

describe("MessageComposer", () => {
  it("shows the failure reason when onSend rejects, and keeps the draft", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    const onSend = vi.fn().mockRejectedValue(new Error("相互フォロー関係にないため送信できません"));

    await act(async () => {
      root.render(<MessageComposer onSend={onSend} />);
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const form = container.querySelector("form") as HTMLFormElement;

    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )!.set!;

    await act(async () => {
      nativeValueSetter.call(textarea, "hello");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    await flush();

    expect(onSend).toHaveBeenCalledWith("hello");
    expect(container.textContent).toContain("相互フォロー関係にないため送信できません");
    expect(textarea.value).toBe("hello");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
