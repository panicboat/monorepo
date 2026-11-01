// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

const send = vi.fn(async () => {});

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
}));

vi.mock("@/modules/messaging", () => ({
  useMessages: () => ({ messages: [], hasMore: false, loading: false, send, markRead: async () => {}, loadMore: () => {} }),
  useThread: () => ({ thread: null, sendRestriction: "none", loading: false }),
}));

vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => null }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "viewer-1" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { default: ChatPage } = await import("./page");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("ChatPage scrolling", () => {
  it("returns to the latest message after the viewer sends while scrolled up", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ChatPage />);
    });

    const scroller = container.querySelector(".overflow-y-auto") as HTMLElement;
    scroller.scrollTop = -300;

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    const nativeValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")!.set!;
    await act(async () => {
      nativeValueSetter.call(textarea, "hello");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(send).toHaveBeenCalledWith("hello");
    expect(scroller.scrollTop).toBe(0);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
