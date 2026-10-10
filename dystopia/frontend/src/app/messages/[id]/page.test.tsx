import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MessageView, SendRestrictionView, ThreadView } from "@/modules/messaging/types";

const mocks = vi.hoisted(() => ({
  thread: null as ThreadView | null,
  sendRestriction: "none" as SendRestrictionView,
  threadLoading: false,
  messages: [] as MessageView[],
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
}));

vi.mock("@/modules/messaging", () => ({
  useMessages: () => ({
    messages: mocks.messages,
    hasMore: false,
    loading: false,
    send: async () => {},
    markRead: async () => {},
    loadMore: () => {},
  }),
  useThread: () => ({ thread: mocks.thread, sendRestriction: mocks.sendRestriction, loading: mocks.threadLoading }),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "viewer-1" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { default: ChatPage } = await import("./page");

const counterpart = { profileId: "cast-1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" as const };
const thread: ThreadView = { id: "t-1", counterpart, lastMessage: null, unreadCount: 0, lastMessageAt: "" };
const incoming: MessageView = { id: "m-1", threadId: "t-1", senderProfileId: "cast-1", content: "こんにちは", createdAt: "" };

beforeEach(() => {
  mocks.thread = thread;
  mocks.sendRestriction = "none";
  mocks.threadLoading = false;
  mocks.messages = [incoming];
});

describe("ChatPage", () => {
  it("heads the conversation with the counterpart's name linked to their profile", () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toMatch(/<a[^>]*href="\/u\/yuna"[^>]*>.*<h1[^>]*>ゆな<\/h1>/);
  });

  it("shows the counterpart's initial beside an incoming message instead of a placeholder", () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).not.toContain(">?<");
    expect(html.match(/>ゆ</g)?.length).toBe(2);
  });

  it("offers the composer when nothing restricts the viewer from sending", () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toContain("<textarea");
  });

  it("replaces the composer with the reason when the viewer must follow the counterpart first", () => {
    mocks.sendRestriction = "follow_required";

    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).not.toContain("<textarea");
    expect(html).toContain("相手をフォローするとメッセージを送れます");
    expect(html).toContain("プロフィールを見る");
  });

  it("names a withdrawn counterpart without a profile link", () => {
    mocks.thread = { ...thread, counterpart: null };
    mocks.sendRestriction = "counterpart_unavailable";

    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toContain("(退会)");
    expect(html).not.toContain('href="/u/');
  });
});
