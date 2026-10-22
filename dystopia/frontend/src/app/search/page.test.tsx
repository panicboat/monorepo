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

const navigation = vi.hoisted(() => ({ query: null as string | null, tab: null as string | null }));
const enterKeys = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/motion/useEnterAnimation", () => ({
  useEnterAnimation: (_ref: unknown, key: string) => {
    enterKeys.push(key);
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    if (navigation.query === null && navigation.tab === null) return null;
    const params = new URLSearchParams();
    if (navigation.query !== null) params.set("q", navigation.query);
    if (navigation.tab !== null) params.set("tab", navigation.tab);
    return params;
  },
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

vi.mock("@/modules/schedule/components/ScheduleSearchPanel", () => ({
  ScheduleSearchPanel: ({ query }: { query: string }) => <div data-panel="schedules" data-query={query} />,
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
  it("shows the page heading above the search box", async () => {
    navigation.query = null;
    hookMocks.useSearchUsers.mockReturnValue({ profiles: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() });
    hookMocks.useSearchPosts.mockReturnValue({ posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() });
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SearchPage />);
    });

    expect(container.querySelector("h1")?.textContent).toBe("検索");
    expect(container.textContent).toContain("ユーザーや投稿を探す");
    await act(async () => root.unmount());
    container.remove();
  });
  it("fades the results again when the post tab is selected", async () => {
    navigation.query = null;
    const empty = { profiles: [], posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() };
    hookMocks.useSearchUsers.mockReset().mockReturnValue(empty);
    hookMocks.useSearchPosts.mockReset().mockReturnValue(empty);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<SearchPage />);
    });
    expect(enterKeys.at(-1)).toBe("users");

    await act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "投稿") as HTMLElement).click();
    });
    expect(enterKeys.at(-1)).toBe("posts");

    await act(async () => root.unmount());
    container.remove();
  });

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
  describe("schedules tab", () => {
    const empty = { profiles: [], posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() };

    async function open() {
      hookMocks.useSearchUsers.mockReset().mockReturnValue(empty);
      hookMocks.useSearchPosts.mockReset().mockReturnValue(empty);
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<SearchPage />);
      });
      const tabs = () => Array.from(container.querySelectorAll('[role="tab"]'));
      return {
        container,
        panel: () => container.querySelector('[data-panel="schedules"]'),
        selectedTab: () => tabs().find((t) => t.getAttribute("aria-selected") === "true")?.textContent,
        tabLabels: () => tabs().map((t) => t.textContent),
        select: (label: string) =>
          act(async () => {
            (tabs().find((t) => t.textContent === label) as HTMLElement).click();
          }),
        unmount: async () => {
          await act(async () => root.unmount());
          container.remove();
          navigation.query = null;
          navigation.tab = null;
        },
      };
    }

    it("adds a 出勤 tab after the user and post tabs", async () => {
      navigation.query = null;
      const view = await open();

      expect(view.tabLabels()).toEqual(["ユーザー", "投稿", "出勤"]);
      expect(view.panel()).toBeNull();

      await view.unmount();
    });

    it("opens on the schedules tab for ?tab=schedules and fetches neither users nor posts", async () => {
      navigation.tab = "schedules";
      const view = await open();

      expect(view.selectedTab()).toBe("出勤");
      expect(view.panel()).not.toBeNull();
      expect(hookMocks.useSearchUsers).toHaveBeenLastCalledWith("", 0);
      expect(hookMocks.useSearchPosts).toHaveBeenLastCalledWith("");

      await view.unmount();
    });

    it("lists schedules with an empty box and hides the search prompt there", async () => {
      navigation.tab = "schedules";
      const view = await open();

      expect((view.container.querySelector('input[aria-label="検索"]') as HTMLInputElement).value).toBe("");
      expect(view.panel()?.getAttribute("data-query")).toBe("");
      expect(view.container.textContent).not.toContain("ユーザー名や投稿内容で検索できます");

      await view.unmount();
    });

    it("keeps the search prompt on the other tabs while the box is empty", async () => {
      navigation.query = null;
      const view = await open();

      expect(view.container.textContent).toContain("ユーザー名や投稿内容で検索できます");
      await view.select("出勤");
      expect(view.container.textContent).not.toContain("ユーザー名や投稿内容で検索できます");
      await view.select("ユーザー");
      expect(view.container.textContent).toContain("ユーザー名や投稿内容で検索できます");

      await view.unmount();
    });

    it("passes the text typed before switching to the schedules tab as the name filter", async () => {
      navigation.query = null;
      const view = await open();
      await typeQuery(view.container.querySelector('input[aria-label="検索"]') as HTMLInputElement, "すず");

      await view.select("出勤");

      expect(view.panel()?.getAttribute("data-query")).toBe("すず");
      expect(hookMocks.useSearchUsers).toHaveBeenLastCalledWith("", 0);
      expect(hookMocks.useSearchPosts).toHaveBeenLastCalledWith("");

      await typeQuery(view.container.querySelector('input[aria-label="検索"]') as HTMLInputElement, "すずか");
      expect(view.panel()?.getAttribute("data-query")).toBe("すずか");

      await view.unmount();
    });

    it("searches users with the typed text again after leaving the schedules tab", async () => {
      navigation.tab = "schedules";
      const view = await open();
      await typeQuery(view.container.querySelector('input[aria-label="検索"]') as HTMLInputElement, "すず");

      await view.select("ユーザー");

      expect(view.panel()).toBeNull();
      expect(hookMocks.useSearchUsers).toHaveBeenLastCalledWith("すず", 0);

      await view.unmount();
    });

    it("ignores an unknown tab in the URL", async () => {
      navigation.tab = "nope";
      const view = await open();

      expect(view.selectedTab()).toBe("ユーザー");

      await view.unmount();
    });
  });
});
