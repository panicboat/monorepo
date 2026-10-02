// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const hookMocks = vi.hoisted(() => ({
  useSearchUsers: vi.fn(),
  useSearchPosts: vi.fn(),
}));

vi.mock("@/modules/discovery", () => ({
  useSearchUsers: hookMocks.useSearchUsers,
  useSearchPosts: hookMocks.useSearchPosts,
}));

vi.mock("@/modules/social", () => ({
  FollowButton: () => null,
}));

vi.mock("@/modules/post/components/PostCardBinding", () => ({
  PostCardBinding: () => null,
}));

const { default: SearchPage } = await import("./page");

function flush() {
  return act(async () => {
    await Promise.resolve();
  });
}

async function typeQuery(input: HTMLInputElement, value: string) {
  const nativeValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )!.set!;

  await act(async () => {
    nativeValueSetter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await flush();
}

describe("SearchPage", () => {
  it("links each matched user's avatar and name to their profile", async () => {
    hookMocks.useSearchUsers.mockReturnValue({
      profiles: [{ accountId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false }],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });
    hookMocks.useSearchPosts.mockReturnValue({
      posts: [],
      hasMore: false,
      loading: false,
      error: undefined,
      loadMore: vi.fn(),
    });

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<SearchPage />);
    });

    const input = container.querySelector('input[aria-label="検索"]') as HTMLInputElement;
    await typeQuery(input, "yuna");

    expect(container.innerHTML).toContain(`<a href="/u/yuna"`);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
