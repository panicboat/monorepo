// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ update: vi.fn() }));

vi.mock("../hooks/useDeleteReview", () => ({ useDeleteReview: () => ({ remove: vi.fn(), loading: false }) }));
vi.mock("../hooks/useHideReview", () => ({ useHideReview: () => ({ hide: vi.fn(), loading: false }) }));
vi.mock("../hooks/useUnhideReview", () => ({ useUnhideReview: () => ({ unhide: vi.fn(), loading: false }) }));
vi.mock("../hooks/useUpdateReview", () => ({ useUpdateReview: () => ({ update: mocks.update, loading: false, error: null }) }));
vi.mock("@/stores/authStore", () => ({ useAuthStore: () => "author-1" }));

const { ReviewEntryCard } = await import("./ReviewEntryCard");

const entry = {
  id: "e-1",
  authorProfileId: "author-1",
  targetProfileId: "target-1",
  authorUsername: "guest_hanako",
  authorAvatarUrl: "",
  targetUsername: "cast_taro",
  targetAvatarUrl: "",
  rating: 4,
  body: "review body",
  hidden: false,
  createdAt: "2026-10-10T00:00:00.000Z",
  updatedAt: "2026-10-10T00:00:00.000Z",
};

const button = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent === label);

describe("ReviewEntryCard edit flow", () => {
  it("opens the form with the stored content, saves it, and returns to the card", async () => {
    mocks.update.mockResolvedValue({ ...entry, body: "review body" });
    const onChanged = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ReviewEntryCard, { entry, mode: "written", onChanged }));
    });

    await act(async () => {
      button(container, "編集")!.click();
    });
    expect(container.querySelector("textarea")?.value).toBe("review body");
    expect(container.querySelector("select")?.value).toBe("4");
    expect(button(container, "編集")).toBeUndefined();

    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mocks.update.mock.calls).toEqual([["e-1", 4, "review body"]]);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(container.querySelector("form")).toBeNull();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps the form open when the save fails", async () => {
    mocks.update.mockReset().mockResolvedValue(null);
    const onChanged = vi.fn();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ReviewEntryCard, { entry, mode: "written", onChanged }));
    });
    await act(async () => {
      button(container, "編集")!.click();
    });
    await act(async () => {
      container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(container.querySelector("form")).not.toBeNull();
    expect(onChanged).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
