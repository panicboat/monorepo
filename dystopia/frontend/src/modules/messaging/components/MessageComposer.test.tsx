// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MessageComposer } from "./MessageComposer";

vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => <span>acting-profile</span> }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function flush() {
  return act(async () => {
    await Promise.resolve();
  });
}

describe("MessageComposer", () => {
  it("shows which profile the message is sent as above the input", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MessageComposer onSend={vi.fn()} />);
    });

    const html = container.innerHTML;
    expect(html.indexOf("acting-profile")).toBeGreaterThanOrEqual(0);
    expect(html.indexOf("acting-profile")).toBeLessThan(html.indexOf("<textarea"));

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("starts as one line that grows with the draft, beside the send button", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MessageComposer onSend={vi.fn()} />);
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(textarea.getAttribute("rows")).toBe("1");
    expect(textarea.className).toContain("min-h-0");
    expect(textarea.className).not.toContain("min-h-24");
    expect(textarea.className).toContain("field-sizing-content");
    expect(button.parentElement).toBe(textarea.parentElement);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("shows the character count only once the draft is over the limit", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<MessageComposer onSend={vi.fn()} />);
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      "value"
    )!.set!;
    const type = (value: string) =>
      act(async () => {
        nativeValueSetter.call(textarea, value);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      });

    await type("a".repeat(5000));
    expect(container.textContent).not.toContain("/5000");

    await type("a".repeat(5001));
    expect(container.textContent).toContain("5001/5000");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

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
