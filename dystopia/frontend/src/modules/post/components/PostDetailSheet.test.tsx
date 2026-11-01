// @vitest-environment happy-dom
import { act, createElement, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePostSheetStore } from "@/stores/postSheetStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));

const search = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  return {
    value: "",
    listeners,
    set(next: string) {
      this.value = next;
      listeners.forEach((l) => l());
    },
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => router,
  useSearchParams: () => {
    const value = useSyncExternalStore(
      (l) => (search.listeners.add(l), () => search.listeners.delete(l)),
      () => search.value
    );
    return new URLSearchParams(value);
  },
}));
vi.mock("./PostDetailContent", () => ({
  PostDetailContent: ({ postId, focusComposer }: { postId: string; focusComposer?: boolean }) => (
    <div>
      detail:{postId}
      focus:{String(!!focusComposer)}
      <a href="/u/yuna">author</a>
      <a href="/">here</a>
      <a href="/?q=tag">query</a>
      <a href="https://example.com/x">external</a>
    </div>
  ),
}));

const { PostDetailSheet } = await import("./PostDetailSheet");

const preventNavigation = (e: Event) => e.preventDefault();

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  router.replace.mockClear();
  router.push.mockClear();
  search.value = "";
  search.listeners.clear();
  document.addEventListener("click", preventNavigation);
});

afterEach(() => {
  document.removeEventListener("click", preventNavigation);
  document.body.innerHTML = "";
});

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(PostDetailSheet));
  });
}

describe("PostDetailSheet", () => {
  it("shows nothing before a post is opened", async () => {
    await mount();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows the opened post's detail and closes through the store", async () => {
    await mount();
    await act(async () => usePostSheetStore.getState().openPost("post-1"));

    expect(document.body.textContent).toContain("投稿の詳細");
    expect(document.body.textContent).toContain("detail:post-1");

    await act(async () => {
      (document.querySelector('button[aria-label="閉じる"]') as HTMLButtonElement).click();
    });

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: false });
  });

  it("focuses the comment composer only when opened to comment", async () => {
    await mount();

    await act(async () => usePostSheetStore.getState().openPost("post-1"));
    expect(document.body.textContent).toContain("focus:false");

    await act(async () => usePostSheetStore.getState().openToComment("post-1"));
    expect(document.body.textContent).toContain("focus:true");
  });

  describe("links inside the sheet", () => {
    async function clickLink(text: string, init: MouseEventInit = {}) {
      await mount();
      await act(async () => usePostSheetStore.getState().openPost("post-1"));
      const link = Array.from(document.querySelectorAll("a")).find((a) => a.textContent === text) as HTMLAnchorElement;
      await act(async () => {
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
      });
    }

    it("replaces the history entry and leaves closing to the pathname change", async () => {
      await clickLink("author");

      expect(router.replace).toHaveBeenCalledWith("/u/yuna");
      expect(router.push).not.toHaveBeenCalled();
      expect(usePostSheetStore.getState().open).toBe(true);
    });

    it("only closes the sheet when the link points at the current URL", async () => {
      await clickLink("here");

      expect(router.replace).not.toHaveBeenCalled();
      expect(usePostSheetStore.getState().open).toBe(false);
    });

    it("replaces without closing when only the query changes, then closes once the query commits", async () => {
      await clickLink("query");

      expect(router.replace).toHaveBeenCalledWith("/?q=tag");
      expect(usePostSheetStore.getState().open).toBe(true);

      await act(async () => search.set("q=tag"));

      expect(usePostSheetStore.getState().open).toBe(false);
    });

    it("leaves a modified click to the browser", async () => {
      await clickLink("author", { metaKey: true });

      expect(router.replace).not.toHaveBeenCalled();
      expect(usePostSheetStore.getState().open).toBe(true);
    });

    it("leaves a link to another origin to the browser", async () => {
      await clickLink("external");

      expect(router.replace).not.toHaveBeenCalled();
      expect(usePostSheetStore.getState().open).toBe(true);
    });
  });
});
