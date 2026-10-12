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

  it("marks only a suggested user whose profile is locked", () => {
    hookMocks.useSuggestedUsers.mockReturnValue({
      profiles: [
        { profileId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: true },
        { profileId: "a2", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false },
      ],
      loading: false,
    });

    const html = renderToStaticMarkup(<SuggestedUsersPane />);

    expect(html.match(/aria-label="鍵付き"/g)).toHaveLength(1);
    expect(html.indexOf('aria-label="鍵付き"')).toBeLessThan(html.indexOf("りん"));
  });

  it("fills the width left of the content column and lists users on an outlined card", () => {
    hookMocks.useSuggestedUsers.mockReturnValue({
      profiles: [{ profileId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
      loading: false,
    });

    const html = renderToStaticMarkup(<SuggestedUsersPane />);
    const aside = /<aside class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];
    const card = /<\/h2><div class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];

    expect(/<h2 class="([^"]*)"/.exec(html)?.[1].split(/\s+/)).toContain("text-[0.9375rem]");
    expect(aside).toEqual(expect.arrayContaining(["flex-1", "min-w-[185px]", "xl:block"]));
    expect(card).toEqual(expect.arrayContaining(["rounded-[17px]", "border", "border-border", "bg-surface"]));
  });
});
