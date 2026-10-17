// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SWRConfig } from "swr";

const fetcherMock = vi.fn();
const authFetchMock = vi.fn();

vi.mock("@/lib/swr", () => ({ fetcher: (...args: unknown[]) => fetcherMock(...args) }));
vi.mock("@/lib/auth", () => ({ authFetch: (...args: unknown[]) => authFetchMock(...args) }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { activeProfileId: string }) => unknown) =>
    selector({ activeProfileId: "profile-1" }),
}));

import { useAuthorPosts } from "./useAuthorPosts";
import { useAuthorComments } from "./useAuthorComments";
import { useAddComment } from "./useAddComment";
import { useDeleteComment } from "./useDeleteComment";
import { revalidatePostLists } from "../lib/revalidate";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;

function mount<T>(useHook: () => T) {
  const result: { current: T } = { current: undefined as T };
  function Probe() {
    result.current = useHook();
    return null;
  }
  root = createRoot(document.createElement("div"));
  const wrapper = (children: ReactNode) =>
    createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, children);
  act(() => {
    root.render(wrapper(createElement(Probe)));
  });
  return result;
}

const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 20)); });

let serverIds: string[];

describe("author list refresh", () => {
  beforeEach(() => {
    fetcherMock.mockReset();
    authFetchMock.mockReset();
    authFetchMock.mockResolvedValue({});
    serverIds = ["a1"];
    fetcherMock.mockImplementation(async () => ({
      posts: serverIds.map((id) => ({ id })),
      comments: serverIds.map((id) => ({ id })),
      postsById: {},
      hasMore: false,
      nextCursor: "",
    }));
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it("shows a newly created post in useAuthorPosts when post lists are revalidated", async () => {
    const hook = mount(() => useAuthorPosts("profile-1", false));
    await flush();
    expect(hook.current.posts).toHaveLength(1);

    serverIds = ["a1", "a2"];
    await act(async () => { await revalidatePostLists(); });
    await flush();

    expect(hook.current.posts).toHaveLength(2);
  });

  it("shows a newly added reply in useAuthorComments", async () => {
    const hook = mount(() => ({ list: useAuthorComments("profile-1"), add: useAddComment("p1") }));
    await flush();
    expect(hook.current.list.comments).toHaveLength(1);

    serverIds = ["a1", "a2"];
    await act(async () => { await hook.current.add.addComment("hi", "c1"); });
    await flush();

    expect(hook.current.list.comments).toHaveLength(2);
  });

  it("drops a deleted reply from useAuthorComments", async () => {
    serverIds = ["a1", "a2"];
    const hook = mount(() => ({ list: useAuthorComments("profile-1"), del: useDeleteComment("p1") }));
    await flush();
    expect(hook.current.list.comments).toHaveLength(2);

    serverIds = ["a1"];
    await act(async () => { await hook.current.del.deleteComment("a2", "c1"); });
    await flush();

    expect(hook.current.list.comments).toHaveLength(1);
  });
});
