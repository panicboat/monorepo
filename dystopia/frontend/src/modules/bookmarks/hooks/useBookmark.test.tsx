// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: { getState: () => ({ activeProfileId: "viewer-1" }) },
}));

const { useBookmark } = await import("./useBookmark");

const current: Record<string, ReturnType<typeof useBookmark>> = {};
let unmount: () => Promise<void>;

async function mountFor(postIds: string[]) {
  const Probe = ({ postId }: { postId: string }) => {
    current[postId] = useBookmark(postId);
    return null;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  await act(async () => {
    root.render(postIds.map((postId) => createElement(Probe, { key: postId, postId })));
  });
}

beforeEach(() => {
  mocks.authFetch.mockReset();
});

afterEach(async () => {
  await unmount();
});

describe("useBookmark status", () => {
  it("fetches the status of every card mounted together in one request", async () => {
    mocks.authFetch.mockResolvedValue({ bookmarked: { "post-1": true, "post-2": false } });

    await mountFor(["post-1", "post-2", "post-3"]);

    expect(mocks.authFetch).toHaveBeenCalledTimes(1);
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/bookmarks/status", {
      method: "POST",
      body: { postIds: ["post-1", "post-2", "post-3"] },
    });
    expect(current["post-1"].isBookmarked).toBe(true);
    expect(current["post-2"].isBookmarked).toBe(false);
    expect(current["post-3"].isBookmarked).toBe(false);
  });
});
