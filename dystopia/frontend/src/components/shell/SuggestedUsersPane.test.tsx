import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const hookMocks = vi.hoisted(() => ({
  useSuggestedUsers: vi.fn(),
}));

vi.mock("@/modules/discovery/hooks", () => ({
  useSuggestedUsers: hookMocks.useSuggestedUsers,
}));

vi.mock("@/modules/social", () => ({
  FollowButton: () => null,
}));

const { SuggestedUsersPane } = await import("./SuggestedUsersPane");

describe("SuggestedUsersPane", () => {
  it("links each suggested user's avatar and name to their profile as two separate links", () => {
    hookMocks.useSuggestedUsers.mockReturnValue({
      profiles: [{ profileId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
      loading: false,
    });

    const html = renderToStaticMarkup(<SuggestedUsersPane />);
    const matches = html.match(/<a[^>]*href="\/u\/yuna"/g) ?? [];

    expect(matches.length).toBe(2);
  });
});
