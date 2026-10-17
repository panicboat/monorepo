import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("../hooks/useBlockedList", () => ({
  useBlockedList: () => ({
    profiles: [{ profileId: "p-9", username: "blocked_one", displayName: "ブロック中", avatarUrl: "", isPrivate: false, role: "guest" }],
    loading: false,
    error: undefined,
  }),
}));
vi.mock("./BlockButton", () => ({ BlockButton: ({ targetProfileId }: { targetProfileId: string }) => <span>block:{targetProfileId}</span> }));

const { BlockedAccountsList } = await import("./BlockedAccountsList");

describe("BlockedAccountsList", () => {
  it("counts and lists the blocked accounts with an unblock control", () => {
    const html = renderToStaticMarkup(<BlockedAccountsList />);

    expect(html).toContain("ブロック中のアカウント 1 件");
    expect(html).toContain("@blocked_one");
    expect(html).toContain("block:p-9");
  });
});
