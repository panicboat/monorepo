// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { PostComposer } from "./PostComposer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("PostComposer submit", () => {
  it("sends the tags written in the text along with the post", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(PostComposer, { onSubmit }));
    });

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "新作届いた #新作 #渋谷");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ content: "新作届いた #新作 #渋谷", hashtags: ["新作", "渋谷"] })
    );

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
