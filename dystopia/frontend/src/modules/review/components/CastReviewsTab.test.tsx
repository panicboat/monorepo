// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProfileSummaryView } from "@/modules/profile/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const viewer = vi.hoisted(() => ({ role: "guest" as string, id: "guest-9", hiddenByLock: false }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string; activeProfileId: string }) => unknown) =>
    selector({ role: viewer.role, activeProfileId: viewer.id }),
  selectRole: (state: { role: string }) => state.role,
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));
vi.mock("../hooks/useCastReviews", () => ({
  useCastReviews: () => ({
    reviews: [],
    summary: { averageRating: 4, raterCount: 1, reviewCount: 2 },
    hiddenByLock: viewer.hiddenByLock,
    hasMore: false,
    loading: false,
    loadMore: vi.fn(),
  }),
}));
vi.mock("./ReviewList", () => ({
  ReviewList: ({ variant, empty }: { variant: string; empty: string }) => <div>list:{variant}:{empty}</div>,
}));
vi.mock("@/components/compose/ComposeToSheet", () => ({
  ComposeToSheet: ({ kind, open, initialTarget }: { kind: string; open: boolean; initialTarget?: ProfileSummaryView }) => (
    <div>compose:{kind}:{String(open)}:{initialTarget?.profileId}</div>
  ),
}));

const { CastReviewsTab } = await import("./CastReviewsTab");

const cast: ProfileSummaryView = { profileId: "cast-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "cast", industry: "" };

const render = async (target: ProfileSummaryView = cast) => {
  const container = document.createElement("div");
  await act(async () => {
    createRoot(container).render(createElement(CastReviewsTab, { cast: target }));
  });
  return container;
};

const writeButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "このキャストのクチコミを書く") as HTMLButtonElement | undefined;

describe("CastReviewsTab", () => {
  beforeEach(() => {
    viewer.role = "guest";
    viewer.id = "guest-9";
    viewer.hiddenByLock = false;
  });

  it("shows the summary above the cast's reviews and lets a guest write one for this cast", async () => {
    const container = await render();

    expect(container.textContent).toContain("4.0");
    expect(container.textContent).toContain("1人が評価 · 2件の評価済みクチコミ");
    expect(container.textContent).toContain("list:cast:クチコミはまだありません");
    expect(container.textContent).not.toContain("compose:");

    await act(async () => {
      writeButton(container)!.click();
    });

    expect(container.textContent).toContain("compose:review:true:cast-1");
  });

  it("shows the notice instead of the summary and the list when hidden by lock", async () => {
    viewer.hiddenByLock = true;
    const container = await render();

    expect(container.textContent).toContain("フォローすると見られます");
    expect(container.textContent).not.toContain("list:");
    expect(container.textContent).not.toContain("利用の満足度");
  });

  it("keeps the write button for a guest when hidden by lock", async () => {
    viewer.hiddenByLock = true;
    const container = await render();

    expect(writeButton(container)).toBeDefined();
    expect(container.textContent).toContain("このキャストのクチコミを書く");
  });

  it("hides the write button from a cast viewer", async () => {
    viewer.role = "cast";
    const container = await render();

    expect(writeButton(container)).toBeUndefined();
  });

  it("hides the write button from the cast herself", async () => {
    viewer.id = "cast-1";
    const container = await render();

    expect(writeButton(container)).toBeUndefined();
  });
});
