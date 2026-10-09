import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  role: "guest" as "guest" | "cast" | null,
  isFollowing: false,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector?: (state: { activeProfileId: string; role: string | null }) => unknown) => {
    const state = { activeProfileId: "viewer-1", role: mocks.role };
    return selector ? selector(state) : state;
  },
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
  selectRole: (state: { role: string | null }) => state.role,
}));

vi.mock("@/modules/social/hooks", () => ({
  useFollow: () => ({ isFollowing: mocks.isFollowing }),
}));

const { StartChatButton } = await import("./StartChatButton");

describe("StartChatButton visibility", () => {
  it("hides the button for a guest viewer who does not follow the target", () => {
    mocks.role = "guest";
    mocks.isFollowing = false;

    const html = renderToStaticMarkup(<StartChatButton targetProfileId="target-1" />);

    expect(html).toBe("");
  });

  it("shows the button for a guest viewer who follows the target", () => {
    mocks.role = "guest";
    mocks.isFollowing = true;

    const html = renderToStaticMarkup(<StartChatButton targetProfileId="target-1" />);

    expect(html).toContain("メッセージを送る");
  });

  it("shows the button for a cast viewer regardless of follow status", () => {
    mocks.role = "cast";
    mocks.isFollowing = false;

    const html = renderToStaticMarkup(<StartChatButton targetProfileId="target-1" />);

    expect(html).toContain("メッセージを送る");
  });
});
