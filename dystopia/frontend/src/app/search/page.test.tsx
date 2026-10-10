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

const navigation = vi.hoisted(() => ({ query: null as string | null }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => (navigation.query === null ? null : new URLSearchParams({ q: navigation.query })),
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

async function searchUsersHtml(isPrivate: boolean) {
  hookMocks.useSearchUsers.mockReturnValue({
    profiles: [{ profileId: "a1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate }],
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
  const html = container.innerHTML;

  await act(async () => {
    root.unmount();
  });
  container.remove();
  return html;
}

describe("SearchPage", () => {
  it("links each matched user's avatar and name to their profile", async () => {
    const html = await searchUsersHtml(false);

    const matches = html.match(/<a[^>]*href="\/u\/yuna"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("marks only a matched user whose profile is locked", async () => {
    expect(await searchUsersHtml(true)).toContain('aria-label="鍵付き"');
    expect(await searchUsersHtml(false)).not.toContain('aria-label="鍵付き"');
  });

  it("opens on the post results for the tag given in the URL", async () => {
    const empty = { profiles: [], posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() };
    hookMocks.useSearchUsers.mockReset().mockReturnValue(empty);
    hookMocks.useSearchPosts.mockReset().mockReturnValue(empty);
    navigation.query = "#新作";

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SearchPage />);
    });

    expect((container.querySelector('input[aria-label="検索"]') as HTMLInputElement).value).toBe("#新作");
    expect(hookMocks.useSearchPosts).toHaveBeenLastCalledWith("#新作");
    expect(hookMocks.useSearchUsers).toHaveBeenLastCalledWith("", 0);

    await act(async () => {
      root.unmount();
    });
    container.remove();
    navigation.query = null;
  });
});
