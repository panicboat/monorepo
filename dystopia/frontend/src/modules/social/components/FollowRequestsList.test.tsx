import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProfileSummaryView } from "@/modules/profile/types";

const state = vi.hoisted(() => ({ requests: [] as ProfileSummaryView[], hasMore: false, loadMore: () => {} }));

vi.mock("../hooks/useFollowRequests", () => ({
  useFollowRequests: () => ({
    requests: state.requests,
    pendingCount: state.requests.length,
    loading: false,
    error: undefined,
    approve: vi.fn(),
    reject: vi.fn(),
    hasMore: state.hasMore,
    loadMore: state.loadMore,
  }),
}));

const { FollowRequestsList } = await import("./FollowRequestsList");

const requester = (overrides: Partial<ProfileSummaryView> = {}): ProfileSummaryView => ({
  profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false, role: "guest", industry: "", ...overrides,
});

describe("FollowRequestsList", () => {
  it("links the requester's avatar and name to their profile beside the approve and reject buttons", () => {
    state.requests = [requester()];
    const html = renderToStaticMarkup(<FollowRequestsList />);

    expect(html.match(/<a[^>]*href="\/u\/rin"/g)?.length).toBe(2);
    expect(html).toContain("承認");
    expect(html).toContain("拒否");
    expect(html).toContain("承認待ちの申請 1 件");
  });

  it("marks a private requester with a lock", () => {
    state.requests = [requester({ isPrivate: true })];

    expect(renderToStaticMarkup(<FollowRequestsList />)).toContain("鍵付き");
  });

  it("shows no lock for a public requester and falls back to the handle", () => {
    state.requests = [requester({ displayName: "" })];
    const html = renderToStaticMarkup(<FollowRequestsList />);

    expect(html).not.toContain("鍵付き");
    expect(html).toContain("@rin");
  });

  it("uses a question mark as the avatar initial for a requester without a name or a handle", () => {
    state.requests = [requester({ displayName: "", username: "" })];
    const html = renderToStaticMarkup(<FollowRequestsList />);

    expect(html.match(/rounded-full[^>]*>(?:<img[^>]*>)?<span[^>]*>([^<]*)<\/span>/)?.[1]).toBe("?");
  });

  it("offers more requests only while there are more to read", () => {
    state.requests = [requester()];
    state.hasMore = true;
    const more = renderToStaticMarkup(<FollowRequestsList />);
    state.hasMore = false;
    const last = renderToStaticMarkup(<FollowRequestsList />);

    expect(more).toContain("もっと見る");
    expect(last).not.toContain("もっと見る");
  });

  it("says so when there are no requests", () => {
    state.requests = [];

    expect(renderToStaticMarkup(<FollowRequestsList />)).toContain("申請はありません。");
  });
});
