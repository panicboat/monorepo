// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({ profileId: "p-1" as string | null, urls: [] as string[] }));

vi.mock("@/lib/swr", () => ({
  fetcher: async (url: string) => {
    state.urls.push(url);
    return url.includes("cursor=") ? { items: ["b"], hasMore: false, nextCursor: "" } : { items: ["a"], hasMore: true, nextCursor: "next/1" };
  },
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (s: { activeProfileId: string | null }) => unknown) => selector({ activeProfileId: state.profileId }),
}));

const { cursorKey, useCursorPages } = await import("./useCursorPages");

type Page = { items: string[]; hasMore: boolean; nextCursor: string };
let list: ReturnType<typeof useCursorPages<Page>>;

function Probe({ url }: { url: string | null }) {
  list = useCursorPages<Page>(url);
  return null;
}

const render = async (url: string | null) => {
  const wrapped = createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(Probe, { url }));
  await act(async () => createRoot(document.createElement("div")).render(wrapped));
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
};

describe("cursorKey", () => {
  it("returns the url for the first page", () => {
    expect(cursorKey("/api/items")(0, null)).toBe("/api/items");
  });

  it("appends an encoded cursor to a url without a query", () => {
    expect(cursorKey("/api/items")(1, { hasMore: true, nextCursor: "a/b" })).toBe("/api/items?cursor=a%2Fb");
  });

  it("appends the cursor to an existing query", () => {
    expect(cursorKey("/api/items?q=x")(1, { hasMore: true, nextCursor: "c" })).toBe("/api/items?q=x&cursor=c");
  });

  it("stops after the last page", () => {
    expect(cursorKey("/api/items")(1, { hasMore: false, nextCursor: "" })).toBeNull();
  });
});

describe("useCursorPages", () => {
  beforeEach(() => {
    state.profileId = "p-1";
    state.urls.length = 0;
  });

  it("loads the next page with the cursor of the previous one", async () => {
    await render("/api/items");
    expect(list.hasMore).toBe(true);

    await act(async () => { await list.loadMore(); });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });

    expect(state.urls).toContain("/api/items?cursor=next%2F1");
    expect(list.pages.flatMap((page) => page.items)).toEqual(["a", "b"]);
    expect(list.hasMore).toBe(false);
  });

  it("fetches nothing without a url", async () => {
    await render(null);

    expect(state.urls).toEqual([]);
    expect(list.hasMore).toBe(false);
  });

  it("fetches nothing without an active profile", async () => {
    state.profileId = null;

    await render("/api/items");

    expect(state.urls).toEqual([]);
  });
});
