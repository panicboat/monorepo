// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ enterKeys: [] as string[] }));

vi.mock("@/lib/motion/useEnterAnimation", () => ({
  useEnterAnimation: (_ref: unknown, key: string) => {
    mocks.enterKeys.push(key);
  },
}));

const emptyPosts = { posts: [], hasMore: false, loading: false, error: undefined, loadMore: vi.fn() };
vi.mock("@/modules/post/hooks/useAuthorPosts", () => ({ useAuthorPosts: () => emptyPosts }));
vi.mock("@/modules/post/hooks/useAuthorLikedPosts", () => ({ useAuthorLikedPosts: () => emptyPosts }));
vi.mock("@/modules/post/hooks/useAuthorComments", () => ({
  useAuthorComments: () => ({ comments: [], postsById: {}, hasMore: false, loading: false, error: undefined, loadMore: vi.fn() }),
}));

const { ProfileContentTabs } = await import("./ProfileContentTabs");

describe("ProfileContentTabs order and above-tabs content", () => {
  it("puts the leading tabs right after posts and the extra tabs at the end", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(ProfileContentTabs, {
          profileId: "p-1",
          isOwnProfile: true,
          leadingTabs: [
            { id: "schedule", label: "出勤", content: <div>schedule-pane</div> },
            { id: "reviews", label: "レビュー", content: <div>reviews-pane</div> },
          ],
          extraTabs: [{ id: "extra", label: "おまけ", content: <div>extra-pane</div> }],
        })
      );
    });

    expect(Array.from(container.querySelectorAll('[role="tab"]')).map((t) => t.textContent)).toEqual([
      "投稿", "出勤", "レビュー", "返信", "メディア", "いいね", "おまけ",
    ]);
  });

  it("renders above the tabs with the selected tab and a way to switch", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(ProfileContentTabs, {
          profileId: "p-1",
          leadingTabs: [{ id: "schedule", label: "出勤", content: <div>schedule-pane</div> }],
          renderAboveTabs: (tab: string, selectTab: (id: string) => void) =>
            tab === "schedule" ? null : (
              <button type="button" onClick={() => selectTab("schedule")}>
                above:{tab}
              </button>
            ),
        })
      );
    });
    expect(container.textContent).toContain("above:posts");

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "above:posts") as HTMLButtonElement).click();
    });

    expect(container.textContent).not.toContain("above:");
    expect(container.textContent).toContain("schedule-pane");
  });

  it("keys the enter animation by the selected tab", async () => {
    mocks.enterKeys.length = 0;
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(ProfileContentTabs, {
          profileId: "p-1",
          leadingTabs: [{ id: "schedule", label: "出勤", content: <div>schedule-pane</div> }],
        })
      );
    });
    expect(mocks.enterKeys.at(-1)).toBe("posts");

    await act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "出勤") as HTMLElement).click();
    });

    expect(mocks.enterKeys.at(-1)).toBe("schedule");
  });
});
