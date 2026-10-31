// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";

const fetcherMock = vi.fn();
const authFetchMock = vi.fn();

vi.mock("@/lib/swr", () => ({ fetcher: (...args: unknown[]) => fetcherMock(...args) }));
vi.mock("@/lib/auth", () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { activeProfileId: string }) => unknown) =>
    selector({ activeProfileId: "profile-1" }),
}));

import { useComments } from "./useComments";
import { useReplies } from "./useReplies";
import { useAddComment } from "./useAddComment";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = (ids: string[]) => ({
  comments: ids.map((id) => ({ id })),
  hasMore: false,
  nextCursor: "",
});

function mount<T>(useHook: () => T) {
  const result: { current: T } = { current: undefined as T };
  function Probe() {
    result.current = useHook();
    return null;
  }
  const root = createRoot(document.createElement("div"));
  const wrapper = (children: ReactNode) =>
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      children
    );
  act(() => {
    root.render(wrapper(createElement(Probe)));
  });
  return result;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

describe("comment list refresh", () => {
  beforeEach(() => {
    fetcherMock.mockReset();
    authFetchMock.mockReset();
    authFetchMock.mockResolvedValue({});
  });

  it("shows a newly added comment in useComments", async () => {
    fetcherMock.mockImplementation(async (url: string) =>
      url.includes("/api/posts/p1/comments") && fetcherMock.mock.calls.length === 1
        ? page(["c1"])
        : page(["c1", "c2"])
    );
    const hook = mount(() => ({ list: useComments("p1"), add: useAddComment("p1") }));
    await flush();
    expect(hook.current.list.comments).toHaveLength(1);
    await act(async () => { await hook.current.add.addComment("hi"); });
    await flush();
    expect(hook.current.list.comments).toHaveLength(2);
  });

  it("shows a newly added reply in useReplies", async () => {
    fetcherMock.mockImplementation(async () =>
      fetcherMock.mock.calls.length === 1 ? page(["r1"]) : page(["r1", "r2"])
    );
    const hook = mount(() => ({ list: useReplies("p1", "c1", true), add: useAddComment("p1") }));
    await flush();
    expect(hook.current.list.replies).toHaveLength(1);
    await act(async () => { await hook.current.add.addComment("hi", "c1"); });
    await flush();
    expect(hook.current.list.replies).toHaveLength(2);
  });
});
