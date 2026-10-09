import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/social/hooks", () => ({
  useSocialCounts: () => ({ followingCount: 12, followersCount: 34 }),
}));

const { SocialCountsLinks } = await import("./SocialCountsLinks");

describe("SocialCountsLinks", () => {
  it("links each count to that account's following/followers list", () => {
    const html = renderToStaticMarkup(<SocialCountsLinks profileId="account-1" username="yuna" />);

    expect(html).toContain('href="/u/yuna/following"');
    expect(html).toContain('href="/u/yuna/followers"');
    expect(html).toContain("12");
    expect(html).toContain("34");
  });
});
