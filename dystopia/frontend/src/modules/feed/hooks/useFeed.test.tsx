// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { usePostFeedStore } from "@/stores/postFeedStore";
import type { FeedFilterValue } from "@/modules/feed/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authFetch = vi.hoisted(() => vi.fn(async () => ({ posts: [], hasMore: false, nextCursor: "" })));
vi.mock("@/lib/auth/fetch", () => ({ authFetch }));

const { useFeed } = await import("./useFeed");

function Probe({ filter, prefecture }: { filter: FeedFilterValue; prefecture?: string }) {
  useFeed({ filter, prefecture });
  return null;
}

async function renderAndPost(filter: FeedFilterValue, prefecture?: string) {
  authFetch.mockClear();
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(Probe, { filter, prefecture }));
  });
  await act(async () => usePostFeedStore.getState().notifyPostCreated());
}

describe("useFeed after a post is created", () => {
  it("does not refetch the area tab while the profile has no prefecture", async () => {
    await renderAndPost("area");

    expect(authFetch).not.toHaveBeenCalled();
  });

  it("refetches the area tab of a profile with a prefecture without sending the prefecture", async () => {
    await renderAndPost("area", "東京都");

    expect(authFetch).toHaveBeenCalledWith("/api/feed?filter=area", expect.anything());
  });
});
