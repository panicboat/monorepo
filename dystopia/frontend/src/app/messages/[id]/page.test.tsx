import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { MessageView, SendRestrictionView, ThreadView } from "@/modules/messaging/types";

const mocks = vi.hoisted(() => ({
  thread: null as ThreadView | null,
  sendRestriction: "none" as SendRestrictionView,
  threadLoading: false,
  messages: [] as MessageView[],
  hasMore: false,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "t-1" }),
}));

vi.mock("@/modules/messaging", () => ({
  useMessages: () => ({
    messages: mocks.messages,
    hasMore: mocks.hasMore,
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

const counterpart = { profileId: "cast-1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" as const, industry: "" };
const thread: ThreadView = { id: "t-1", counterpart, lastMessage: null, unreadCount: 0, lastMessageAt: "" };
const incoming: MessageView = { id: "m-1", threadId: "t-1", senderProfileId: "cast-1", content: "こんにちは", createdAt: "" };

beforeEach(() => {
  mocks.thread = thread;
  mocks.sendRestriction = "none";
  mocks.threadLoading = false;
  mocks.messages = [incoming];
  mocks.hasMore = false;
});

describe("ChatPage", () => {
  it("keeps the ban on direct deals under the heading", () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toMatch(
      /<\/h1>.*<p role="note"[^>]*>当DMでの直接の金銭交渉・店舗を介さない直接取引（裏引き）は固く禁じます。<\/p><\/header>/
    );
  });

  it("heads the conversation with the counterpart's name linked to their profile", () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toMatch(/<a[^>]*href="\/u\/yuna"[^>]*>.*<h1[^>]*>.*ゆな.*とのメッセージ.*<\/h1>/);
  });

  it("shows the counterpart's initial beside an incoming message instead of a placeholder", () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).not.toContain(">?<");
    expect(html.match(/>ゆ</g)?.length).toBe(2);
  });

  it("anchors the scrolling list to the latest message", () => {
    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toMatch(/<div class="[^"]*\bflex-col-reverse\b[^"]*\boverflow-y-auto\b[^"]*">/);
  });

  it("keeps the load-more button from pulling the view to the top when older messages arrive", () => {
    mocks.hasMore = true;

    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toMatch(/<div class="[^"]*\[overflow-anchor:none\][^"]*"><button[^>]*>/);
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

  it("marks only a counterpart whose profile is locked", () => {
    mocks.thread = { ...thread, counterpart: { ...counterpart, isPrivate: true } };
    const locked = renderToStaticMarkup(<ChatPage />);
    mocks.thread = thread;
    const open = renderToStaticMarkup(<ChatPage />);

    expect(locked).toContain('aria-label="鍵付き"');
    expect(open).not.toContain('aria-label="鍵付き"');
  });

  it("names a withdrawn counterpart without a profile link", () => {
    mocks.thread = { ...thread, counterpart: null };
    mocks.sendRestriction = "counterpart_unavailable";

    const html = renderToStaticMarkup(<ChatPage />);

    expect(html).toContain("（無効なユーザー）");
    expect(html).toContain("とのメッセージ");
    expect(html).not.toContain('href="/u/');
  });
});

describe("ChatPage report", () => {
  it("offers the report only on messages from the counterpart", () => {
    mocks.messages = [incoming];
    expect(renderToStaticMarkup(<ChatPage />)).toContain("通報");

    mocks.messages = [{ ...incoming, senderProfileId: "viewer-1" }];
    expect(renderToStaticMarkup(<ChatPage />)).not.toContain("通報");
  });
});
