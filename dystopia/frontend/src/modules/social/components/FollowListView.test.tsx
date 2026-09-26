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
  profiles: [{ accountId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
  hasMore: false,
  loading: false,
  error: undefined,
  loadMore: vi.fn(),
  refresh: vi.fn(),
};

const followers = {
  profiles: [{ accountId: "a2", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false }],
  hasMore: false,
  loading: false,
  error: undefined,
  loadMore: vi.fn(),
  refresh: vi.fn(),
};

describe("FollowListView", () => {
  it("passes the given accountId through to both list hooks", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    renderToStaticMarkup(<FollowListView accountId="account-1" />);

    expect(hookMocks.useFollowList).toHaveBeenCalledWith("account-1");
    expect(hookMocks.useFollowerList).toHaveBeenCalledWith("account-1");
  });

  it("defaults to the following tab and shows its profiles", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    const html = renderToStaticMarkup(<FollowListView accountId="account-1" />);

    expect(html).toContain("ゆな");
    expect(html).not.toContain("りん");
  });

  it("shows the followers list when initialTab is followers", () => {
    hookMocks.useFollowList.mockReturnValue(following);
    hookMocks.useFollowerList.mockReturnValue(followers);

    const html = renderToStaticMarkup(<FollowListView accountId="account-1" initialTab="followers" />);

    expect(html).toContain("りん");
    expect(html).not.toContain("ゆな");
  });
});
