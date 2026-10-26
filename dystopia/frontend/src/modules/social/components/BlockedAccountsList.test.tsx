import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ isPrivate: false, hasMore: false }));

vi.mock("../hooks/useBlockedList", () => ({
  useBlockedList: () => ({
    profiles: [{ profileId: "p-9", username: "blocked_one", displayName: "ブロック中", avatarUrl: "", isPrivate: mocks.isPrivate, role: "guest", industry: "" }],
    loading: false,
    error: undefined,
    hasMore: mocks.hasMore,
    loadMore: () => {},
  }),
}));
vi.mock("./BlockButton", () => ({ BlockButton: ({ targetProfileId }: { targetProfileId: string }) => <span>block:{targetProfileId}</span> }));

const { BlockedAccountsList } = await import("./BlockedAccountsList");

describe("BlockedAccountsList", () => {
  it("lists the blocked accounts with an unblock control, without a count it could not keep whole", () => {
    const html = renderToStaticMarkup(<BlockedAccountsList />);

    expect(html).toContain("ブロック中のアカウント");
    expect(html).not.toContain("1 件");
    expect(html).toContain("@blocked_one");
    expect(html).toContain("block:p-9");
  });

  it("offers more blocked accounts only while there are more to read", () => {
    mocks.hasMore = true;
    const more = renderToStaticMarkup(<BlockedAccountsList />);
    mocks.hasMore = false;

    expect(more).toContain("もっと見る");
    expect(renderToStaticMarkup(<BlockedAccountsList />)).not.toContain("もっと見る");
  });

  it("marks only a blocked account whose profile is locked", () => {
    mocks.isPrivate = true;
    const locked = renderToStaticMarkup(<BlockedAccountsList />);
    mocks.isPrivate = false;
    const open = renderToStaticMarkup(<BlockedAccountsList />);

    expect(locked).toContain('aria-label="鍵付き"');
    expect(open).not.toContain('aria-label="鍵付き"');
  });
});
