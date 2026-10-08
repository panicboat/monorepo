// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string; role: string }) => unknown) =>
    selector({ activeProfileId: "viewer-1", role: "cast" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
  selectRole: (state: { role: string }) => state.role,
}));

vi.mock("@/modules/social/hooks", () => ({
  useFollow: () => ({ isFollowing: false }),
}));

const { StartChatButton } = await import("./StartChatButton");

describe("StartChatButton request", () => {
  it("opens the thread with the target profile as recipientProfileId and navigates to it", async () => {
    mocks.authFetch.mockResolvedValue({ thread: { id: "thread-1" } });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<StartChatButton targetProfileId="target-1" />);
    });
    await act(async () => {
      container.querySelector("button")!.click();
    });

    expect(mocks.authFetch).toHaveBeenCalledWith("/api/messaging/threads", {
      method: "POST",
      body: { recipientProfileId: "target-1" },
    });
    expect(mocks.push).toHaveBeenCalledWith("/messages/thread-1");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
