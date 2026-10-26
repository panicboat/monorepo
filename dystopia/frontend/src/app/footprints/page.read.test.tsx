// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({ loaded: false, markFootprintsRead: vi.fn(async () => {}) }));

vi.mock("@/modules/footprints", () => ({
  useFootprints: () => ({ footprints: [], hasMore: false, loading: !state.loaded, loaded: state.loaded, error: undefined, loadMore: vi.fn() }),
  useFootprintsUnreadCount: () => ({ count: 0, refresh: vi.fn() }),
  markFootprintsRead: state.markFootprintsRead,
}));
vi.mock("@/modules/footprints/components/FootprintRow", () => ({ FootprintRow: () => null }));

const { default: FootprintsPage } = await import("./page");

describe("FootprintsPage", () => {
  it("marks the footprints read only after the list that shows what was unread has loaded", async () => {
    const container = document.createElement("div");
    let root: Root;
    await act(async () => {
      root = createRoot(container);
      root.render(createElement(FootprintsPage));
    });
    expect(state.markFootprintsRead).not.toHaveBeenCalled();

    state.loaded = true;
    await act(async () => root.render(createElement(FootprintsPage)));
    await act(async () => root.render(createElement(FootprintsPage)));

    expect(state.markFootprintsRead).toHaveBeenCalledTimes(1);
  });
});
