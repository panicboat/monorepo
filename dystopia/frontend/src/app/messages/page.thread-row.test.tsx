import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ThreadView } from "@/modules/messaging/types";

vi.mock("@/modules/messaging", () => ({ useThreads: vi.fn() }));
vi.mock("@/components/compose/ComposeToSheet", () => ({ ComposeToSheet: () => null }));

const { ThreadRow } = await import("./page");

const thread: ThreadView = {
  id: "t-1",
  counterpart: { profileId: "cast-1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast", industry: "" },
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

    expect(html).toContain("（無効なユーザー）");
  });

  it("links the card to the thread and the counterpart to their profile", () => {
    const html = renderToStaticMarkup(<ThreadRow thread={thread} />);

    expect(html.match(/<a[^>]*href="\/messages\/t-1"/g)?.length).toBe(1);
    expect(html.match(/<a[^>]*href="\/u\/yuna"/g)?.length).toBe(2);
  });

  it("shows the unread count inside the card", () => {
    const html = renderToStaticMarkup(<ThreadRow thread={{ ...thread, unreadCount: 3 }} />);

    expect(html).toMatch(/<a[^>]*href="\/messages\/t-1"[^>]*>.*>3<.*<\/a>/);
    expect(html).toContain('aria-label="未読"');
  });
});
