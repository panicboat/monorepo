import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) =>
    selector({ activeProfileId: "viewer-1" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { StartChatButton } = await import("./StartChatButton");

describe("StartChatButton", () => {
  it("shows the button for another profile", () => {
    const html = renderToStaticMarkup(<StartChatButton targetProfileId="target-1" />);

    expect(html).toContain("メッセージ");
  });

  it("renders nothing on the viewer's own profile", () => {
    const html = renderToStaticMarkup(<StartChatButton targetProfileId="viewer-1" />);

    expect(html).toBe("");
  });
});
