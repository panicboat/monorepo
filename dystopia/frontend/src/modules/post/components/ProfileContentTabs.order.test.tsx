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

const { ProfileContentTabs } = await import("./ProfileContentTabs");

describe("ProfileContentTabs order and initial tab", () => {
  it("puts the leading tabs right after posts and the extra tabs at the end", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(ProfileContentTabs, {
          profileId: "p-1",
          isOwnProfile: true,
          leadingTabs: [
            { id: "schedule", label: "予定", content: <div>schedule-pane</div> },
            { id: "reviews", label: "クチコミ", content: <div>reviews-pane</div> },
          ],
          extraTabs: [{ id: "extra", label: "おまけ", content: <div>extra-pane</div> }],
        })
      );
    });

    expect(Array.from(container.querySelectorAll('[role="tab"]')).map((t) => t.textContent)).toEqual([
      "投稿", "予定", "クチコミ", "メディア", "いいね", "おまけ",
    ]);
  });

  it("opens on the initial tab and falls back to posts for an unknown one", async () => {
    const render = async (initialTab: string) => {
      const container = document.createElement("div");
      document.body.appendChild(container);
      await act(async () => {
        createRoot(container).render(
          createElement(ProfileContentTabs, {
            profileId: "p-1",
            initialTab,
            leadingTabs: [{ id: "schedule", label: "予定", content: <div>schedule-pane</div> }],
          })
        );
      });
      return container.querySelector('[role="tab"][aria-selected="true"]')?.textContent;
    };

    expect(await render("schedule")).toBe("予定");
    expect(await render("nope")).toBe("投稿");
  });
  it("keys the enter animation by the selected tab", async () => {
    mocks.enterKeys.length = 0;
    const container = document.createElement("div");
    document.body.appendChild(container);
    await act(async () => {
      createRoot(container).render(
        createElement(ProfileContentTabs, {
          profileId: "p-1",
          leadingTabs: [{ id: "schedule", label: "予定", content: <div>schedule-pane</div> }],
        })
      );
    });
    expect(mocks.enterKeys.at(-1)).toBe("posts");

    await act(async () => {
      (Array.from(container.querySelectorAll('[role="tab"]')).find((t) => t.textContent === "予定") as HTMLElement).click();
    });

    expect(mocks.enterKeys.at(-1)).toBe("schedule");
  });
});
