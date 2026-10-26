// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/messaging", () => ({
  useThreads: () => ({
    threads: [
      {
        id: "t-1",
        counterpart: { profileId: "p-2", username: "yuna", displayName: "ゆな", avatarUrl: "" },
        lastMessage: null,
        lastMessageAt: "",
        unreadCount: 0,
      },
    ],
    totalUnreadCount: 0,
    loading: false,
    error: undefined,
    hasMore: true,
    loadMore: () => {},
  }),
}));
vi.mock("@/components/compose/ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open }: { kind: string; open: boolean }) => <div>compose:{kind}:{String(open)}</div>,
}));

const { default: MessagesPage } = await import("./page");

describe("MessagesPage", () => {
  it("starts a new message from the list and marks a thread without messages", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(createElement(MessagesPage));
    });

    expect(container.textContent).toContain("メッセージはまだありません");
    expect(container.textContent).toContain("もっと見る");
    expect(container.querySelector('a[href="/messages/t-1"] svg[aria-hidden="true"]')).not.toBeNull();
    expect(container.textContent).not.toContain("compose:");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "＋ 新しいメッセージ") as HTMLButtonElement).click();
    });

    expect(container.textContent).toContain("compose:message:true");
  });
});
