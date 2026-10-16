// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { SocialProfileView } from "@/modules/social/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ role: "guest" as "guest" | "cast" }));

const list = { entries: [], hasMore: false, loading: false, loadMore: vi.fn(), refresh: vi.fn() };
vi.mock("../hooks/useReviewsByTarget", () => ({ useReviewsByTarget: () => list }));
vi.mock("../hooks/useReviewsByAuthor", () => ({ useReviewsByAuthor: () => list }));
vi.mock("./ReviewList", () => ({ ReviewList: ({ variant }: { variant: string }) => <div>list:{variant}</div> }));
vi.mock("@/components/compose/ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open, initialTarget }: { kind: string; open: boolean; initialTarget?: SocialProfileView }) => (
    <div>compose:{kind}:{String(open)}:{initialTarget?.profileId}</div>
  ),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string }) => unknown) => selector({ role: mocks.role }),
  selectRole: (state: { role: string }) => state.role,
}));

const { ReviewsTab } = await import("./ReviewsTab");

const cast: SocialProfileView = { profileId: "cast-1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" };

async function mount(mode: "received" | "written") {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(ReviewsTab, { profileId: "cast-1", mode, target: cast }));
  });
  return container;
}

describe("ReviewsTab", () => {
  it("lets a guest write a review for the cast from the cast's tab", async () => {
    mocks.role = "guest";
    const container = await mount("received");

    expect(container.textContent).toContain("list:target");
    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "レビューを書く") as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("compose:review:true:cast-1");
  });

  it("does not offer writing to a cast or on a written list", async () => {
    mocks.role = "cast";
    expect((await mount("received")).textContent).not.toContain("レビューを書く");

    mocks.role = "guest";
    const written = await mount("written");
    expect(written.textContent).not.toContain("レビューを書く");
    expect(written.textContent).toContain("list:author");
  });
});
