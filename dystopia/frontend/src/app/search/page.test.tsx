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

const navigation = vi.hoisted(() => ({
  query: null as string | null,
  tab: null as string | null,
  extra: {} as Record<string, string>,
  replace: vi.fn(),
}));
const panel = vi.hoisted(() => ({ next: null as unknown }));
const acting = vi.hoisted(() => ({ profile: null as { prefecture: string; area: string } | null, loading: false }));
const enterKeys = vi.hoisted(() => [] as string[]);

vi.mock("@/lib/motion/useEnterAnimation", () => ({
  useEnterAnimation: (_ref: unknown, key: string) => {
    enterKeys.push(key);
  },
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    if (navigation.query === null && navigation.tab === null && Object.keys(navigation.extra).length === 0) return null;
    const params = new URLSearchParams();
    if (navigation.query !== null) params.set("q", navigation.query);
    if (navigation.tab !== null) params.set("tab", navigation.tab);
    for (const [key, value] of Object.entries(navigation.extra)) params.set(key, value);
    return params;
  },
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock("@/modules/profile/hooks", () => ({
  useProfile: () => ({ profile: acting.profile, loading: acting.loading }),
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
  ScheduleSearchPanel: ({ query, choices, onChoicesChange }: { query: string; choices: unknown; onChoicesChange: (next: unknown) => void }) => (
    <div data-panel="schedules" data-query={query} data-choices={JSON.stringify(choices)}>
      <button type="button" data-choose onClick={() => onChoicesChange(panel.next)}>
        choose
      </button>
    </div>
  ),
}));

const { default: SearchPage } = await import("./page");
const { defaultSearchChoices, searchDays } = await import("@/modules/schedule/lib/searchChoices");

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
  navigation.tab = "users";
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
  navigation.tab = null;
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
    expect(enterKeys.at(-1)).toBe("schedules");

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
      navigation.replace.mockReset();
      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(<SearchPage />);
      });
      const tabs = () => Array.from(container.querySelectorAll('[role="tab"]'));
      return {
        container,
        rerender: () =>
          act(async () => {
            root.render(<SearchPage />);
          }),
        panel: () => container.querySelector('[data-panel="schedules"]'),
        choices: () => JSON.parse(container.querySelector('[data-panel="schedules"]')!.getAttribute("data-choices")!),
        choose: (next: unknown) => {
          panel.next = next;
          return act(async () => {
            (container.querySelector("[data-choose]") as HTMLElement).click();
          });
        },
        input: () => container.querySelector('input[aria-label="検索"]') as HTMLInputElement,
        lastUrl: () => new URL(navigation.replace.mock.lastCall![0] as string, "http://localhost"),
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
          navigation.extra = {};
        },
      };
    }

    it("puts the 予定 tab first and opens on it when nothing is searched", async () => {
      navigation.query = null;
      const view = await open();

      expect(view.tabLabels()).toEqual(["予定", "ユーザー", "投稿"]);
      expect(view.selectedTab()).toBe("予定");
      expect(view.panel()).not.toBeNull();

      await view.unmount();
    });

    it("opens on the schedules tab for ?tab=schedules and fetches neither users nor posts", async () => {
      navigation.tab = "schedules";
      const view = await open();

      expect(view.selectedTab()).toBe("予定");
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

      expect(view.container.textContent).not.toContain("ユーザー名や投稿内容で検索できます");
      await view.select("ユーザー");
      expect(view.container.textContent).toContain("ユーザー名や投稿内容で検索できます");
      await view.select("予定");
      expect(view.container.textContent).not.toContain("ユーザー名や投稿内容で検索できます");

      await view.unmount();
    });

    it("passes the text typed before switching to the schedules tab as the name filter", async () => {
      navigation.query = null;
      const view = await open();
      await typeQuery(view.container.querySelector('input[aria-label="検索"]') as HTMLInputElement, "すず");

      await view.select("予定");

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

    it("opens on the user results for a name given in the URL", async () => {
      navigation.query = "yuna";
      const view = await open();

      expect(view.selectedTab()).toBe("ユーザー");

      await view.unmount();
    });

    it("ignores an unknown tab in the URL", async () => {
      navigation.tab = "nope";
      const view = await open();

      expect(view.selectedTab()).toBe("予定");

      await view.unmount();
    });

    it("asks for a name on the schedules tab and keeps the other placeholder elsewhere", async () => {
      navigation.query = null;
      const view = await open();
      expect(view.input().placeholder).toBe("名前で絞り込む");
      expect(view.input().getAttribute("aria-label")).toBe("検索");

      await view.select("投稿");
      expect(view.input().placeholder).toBe("ユーザーや投稿を検索");
      await view.select("ユーザー");
      expect(view.input().placeholder).toBe("ユーザーや投稿を検索");

      await view.unmount();
    });

    describe("URL state", () => {
      const tomorrow = () => searchDays()[1];

      it("writes the tab with router.replace each time it is switched, without scrolling", async () => {
        navigation.query = null;
        const view = await open();
        expect(navigation.replace).not.toHaveBeenCalled();

        await view.select("予定");
        expect(navigation.replace).toHaveBeenLastCalledWith("/search?tab=schedules", { scroll: false });
        await view.select("投稿");
        expect(navigation.replace).toHaveBeenLastCalledWith("/search?tab=posts", { scroll: false });
        await view.select("ユーザー");
        expect(navigation.replace).toHaveBeenLastCalledWith("/search?tab=users", { scroll: false });
        expect(navigation.replace).toHaveBeenCalledTimes(3);

        await view.unmount();
      });

      it("keeps the q of the URL when it writes the tab", async () => {
        navigation.query = "#新作";
        const view = await open();

        await view.select("ユーザー");

        expect(view.lastUrl().searchParams.get("q")).toBe("#新作");
        expect(view.lastUrl().searchParams.get("tab")).toBe("users");

        await view.unmount();
      });

      it("writes the date, prefecture, area, industry, start band and following switch while on the schedules tab", async () => {
        navigation.tab = "schedules";
        const view = await open();

        await view.choose({ date: tomorrow(), prefecture: "東京都", area: "新宿", industry: "ソープ", timeBand: "night", followingOnly: true });

        expect(Object.fromEntries(view.lastUrl().searchParams)).toEqual({
          tab: "schedules",
          date: tomorrow(),
          prefecture: "東京都",
          area: "新宿",
          industry: "ソープ",
          timeBand: "night",
          following: "1",
        });
        expect(navigation.replace).toHaveBeenLastCalledWith(expect.any(String), { scroll: false });

        await view.choose(defaultSearchChoices());
        expect(Object.fromEntries(view.lastUrl().searchParams)).toEqual({ tab: "schedules" });

        await view.unmount();
      });

      it("drops the filters from the URL on the other tabs and brings them back with the schedules tab", async () => {
        navigation.tab = "schedules";
        const view = await open();
        const chosen = { date: tomorrow(), prefecture: "大阪府", area: "", industry: "", timeBand: "day", followingOnly: false };
        await view.choose(chosen);

        await view.select("ユーザー");
        expect(Object.fromEntries(view.lastUrl().searchParams)).toEqual({ tab: "users" });

        await view.select("予定");
        expect(view.choices()).toEqual(chosen);
        expect(Object.fromEntries(view.lastUrl().searchParams)).toEqual({ tab: "schedules", date: tomorrow(), prefecture: "大阪府", timeBand: "day" });

        await view.unmount();
      });

      it("starts from the acting profile's main area and keeps 全国 in the URL once it is chosen", async () => {
        acting.profile = { prefecture: "東京都", area: "新宿" };
        navigation.tab = "schedules";
        const view = await open();

        expect(view.choices()).toMatchObject({ prefecture: "東京都", area: "新宿" });

        await view.choose({ ...view.choices(), prefecture: "", area: "" });
        expect(view.lastUrl().searchParams.get("prefecture")).toBe("");
        expect(view.lastUrl().searchParams.has("area")).toBe(false);

        await view.choose(defaultSearchChoices({ prefecture: "東京都", area: "新宿" }));
        expect(Object.fromEntries(view.lastUrl().searchParams)).toEqual({ tab: "schedules" });

        await view.unmount();
        acting.profile = null;
      });

      it("shows nothing until the acting profile is loaded", async () => {
        acting.loading = true;
        const view = await open();

        expect(view.container.innerHTML).toBe("");

        await view.unmount();
        acting.loading = false;
      });

      it("restores the filters written in the URL", async () => {
        navigation.tab = "schedules";
        navigation.extra = { date: tomorrow(), prefecture: "東京都", area: "新宿", industry: "ソープ", timeBand: "night", following: "1" };
        const view = await open();

        expect(view.selectedTab()).toBe("予定");
        expect(view.choices()).toEqual({ date: tomorrow(), prefecture: "東京都", area: "新宿", industry: "ソープ", timeBand: "night", followingOnly: true });
        expect(navigation.replace).not.toHaveBeenCalled();

        await view.unmount();
      });

      it("falls back to today, every area and every start band for values that do not fit", async () => {
        navigation.tab = "schedules";
        navigation.extra = { date: "2020-01-01", prefecture: "Narnia", area: "新宿", industry: "soap", timeBand: "noon", following: "yes" };
        const view = await open();

        expect(view.choices()).toEqual(defaultSearchChoices());

        await view.unmount();
      });

      it("keeps what was typed when only the tab in the URL changes, and starts over when the q changes", async () => {
        navigation.query = null;
        const view = await open();
        await typeQuery(view.input(), "すず");

        navigation.tab = "schedules";
        await view.rerender();
        expect(view.input().value).toBe("すず");

        navigation.query = "#新作";
        await view.rerender();
        expect(view.input().value).toBe("#新作");

        await view.unmount();
      });
    });
  });
});
