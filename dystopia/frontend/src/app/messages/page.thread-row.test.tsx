import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ThreadView } from "@/modules/messaging/types";

vi.mock("@/modules/messaging", () => ({ useThreads: vi.fn() }));
vi.mock("@/components/compose/ComposeToSheet", () => ({ ComposeToSheet: () => null }));

const { ThreadRow } = await import("./page");

const thread: ThreadView = {
  id: "t-1",
  counterpart: { profileId: "cast-1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" },
  lastMessage: null,
  unreadCount: 0,
  lastMessageAt: "",
};

describe("ThreadRow", () => {
  it("marks only a counterpart whose profile is locked", () => {
    const locked = renderToStaticMarkup(
      <ThreadRow thread={{ ...thread, counterpart: { ...thread.counterpart!, isPrivate: true } }} />
    );
    const open = renderToStaticMarkup(<ThreadRow thread={thread} />);

    expect(locked).toContain('aria-label="鍵付き"');
    expect(open).not.toContain('aria-label="鍵付き"');
  });

  it("shows a deleted-profile label when the counterpart is gone", () => {
    const html = renderToStaticMarkup(<ThreadRow thread={{ ...thread, counterpart: null }} />);

    expect(html).toContain("削除したプロフィール");
  });

  it("links the whole row to the thread without nesting a profile link", () => {
    const html = renderToStaticMarkup(<ThreadRow thread={thread} />);

    expect(html.match(/<a /g)?.length).toBe(1);
  });
});
