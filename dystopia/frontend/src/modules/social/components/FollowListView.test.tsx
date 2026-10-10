import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const hookMocks = vi.hoisted(() => ({
  useFollowList: vi.fn(),
  useFollowerList: vi.fn(),
}));

vi.mock("@/modules/social/hooks", () => ({
  useFollowList: hookMocks.useFollowList,
  useFollowerList: hookMocks.useFollowerList,
}));

vi.mock("./FollowButton", () => ({
  FollowButton: () => null,
}));

const { FollowListView } = await import("./FollowListView");

const following = {
  profiles: [{ profileId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
  hasMore: false,
  loading: false,
  error: undefined,
  loadMore: vi.fn(),
  refresh: vi.fn(),
};

const followers = {
  profiles: [{ profileId: "a2", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false }],
  hasMore: false,
  loading: false,
  error: undefined,
  loadMore: vi.fn(),
  refresh: vi.fn(),
};

describe("FollowListView", () => {
  it("passes the given profileId through to both list hooks", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    renderToStaticMarkup(<FollowListView profileId="account-1" />);

    expect(hookMocks.useFollowList).toHaveBeenCalledWith("account-1");
    expect(hookMocks.useFollowerList).toHaveBeenCalledWith("account-1");
  });

  it("defaults to the following tab and shows its profiles", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    const html = renderToStaticMarkup(<FollowListView profileId="account-1" />);

    expect(html).toContain("ゆな");
    expect(html).not.toContain("りん");
  });

  it("shows the followers list when initialTab is followers", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    const html = renderToStaticMarkup(<FollowListView profileId="account-1" initialTab="followers" />);

    expect(html).toContain("りん");
    expect(html).not.toContain("ゆな");
  });

  it("links each profile's avatar and name to their profile page", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    const html = renderToStaticMarkup(<FollowListView profileId="account-1" />);

    const matches = html.match(/<a[^>]*href="\/u\/yuna"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("marks only a profile that is locked", () => {
    hookMocks.useFollowerList.mockReturnValue(followers);

    hookMocks.useFollowList.mockReturnValue({ ...following, profiles: [{ ...following.profiles[0], isPrivate: true }] });
    const locked = renderToStaticMarkup(<FollowListView profileId="account-1" />);
    hookMocks.useFollowList.mockReturnValue(following);
    const open = renderToStaticMarkup(<FollowListView profileId="account-1" />);

    expect(locked).toContain('aria-label="鍵付き"');
    expect(open).not.toContain('aria-label="鍵付き"');
  });
});
