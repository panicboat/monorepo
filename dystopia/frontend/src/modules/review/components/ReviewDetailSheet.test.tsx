// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { ReviewEntry } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  viewer: "guest-1",
  remove: vi.fn(),
  hide: vi.fn(),
  unhide: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
  confirm: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: mocks.viewer }),
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));
vi.mock("../hooks/useDeleteReview", () => ({ useDeleteReview: () => ({ remove: mocks.remove, loading: false }) }));
vi.mock("../hooks/useHideReview", () => ({ useHideReview: () => ({ hide: mocks.hide, loading: false }) }));
vi.mock("../hooks/useUnhideReview", () => ({ useUnhideReview: () => ({ unhide: mocks.unhide, loading: false }) }));
vi.mock("../hooks/useUpdateReview", () => ({ useUpdateReview: () => ({ update: mocks.update, loading: false, error: null }) }));

const { ReviewDetailSheet } = await import("./ReviewDetailSheet");

const entry = (overrides: Partial<ReviewEntry> = {}): ReviewEntry => ({
  id: "r-1",
  authorProfileId: "guest-1",
  targetProfileId: "cast-1",
  authorUsername: "hanako",
  authorAvatarUrl: "",
  targetUsername: "yuna",
  targetAvatarUrl: "",
  rating: 4,
  body: "とても丁寧でした",
  hidden: false,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...overrides,
});

let onClose: Mock<() => void>;
let onChanged: Mock<() => void>;

beforeEach(() => {
  for (const fn of [mocks.remove, mocks.hide, mocks.unhide, mocks.update, mocks.toast, mocks.confirm]) fn.mockReset();
  mocks.remove.mockResolvedValue(true);
  mocks.hide.mockResolvedValue(true);
  mocks.unhide.mockResolvedValue(true);
  mocks.update.mockResolvedValue(true);
  mocks.confirm.mockReturnValue(true);
  vi.stubGlobal("confirm", mocks.confirm);
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount(subject: ReviewEntry) {
  onClose = vi.fn();
  onChanged = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(ReviewDetailSheet, { entry: subject, open: true, onClose, onChanged }));
  });
}

const text = () => document.body.textContent ?? "";
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => (b.textContent ?? "").trim() === label) as HTMLButtonElement | undefined;
const click = async (label: string) => {
  await act(async () => {
    button(label)!.click();
  });
};

describe("ReviewDetailSheet", () => {
  it("shows the review in full", async () => {
    mocks.viewer = "someone";
    await mount(entry());

    expect(text()).toContain("レビューの詳細");
    expect(text()).toContain("REVIEW / ゲストからキャスト");
    expect(text()).toContain("@hanako");
    expect(text()).toContain("@yuna へのレビュー");
    expect(text()).toContain("とても丁寧でした");
    expect(button("編集")).toBeUndefined();
    expect(button("非表示にする")).toBeUndefined();
  });

  it("lets the author delete after confirming and closes", async () => {
    mocks.viewer = "guest-1";
    await mount(entry());

    await click("削除");

    expect(mocks.confirm).toHaveBeenCalledWith("このレビューを削除しますか？");
    expect(mocks.remove).toHaveBeenCalledWith("r-1");
    expect(mocks.toast).toHaveBeenCalledWith("レビューを削除しました");
    expect(onChanged).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("lets the author edit in the sheet", async () => {
    mocks.viewer = "guest-1";
    await mount(entry());

    await click("編集");

    expect(document.querySelector('[role="dialog"] textarea')).not.toBeNull();
  });

  const edit = async () => {
    mocks.viewer = "guest-1";
    await mount(entry());
    await click("編集");
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    const select = document.querySelector("select") as HTMLSelectElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, "さらに良かった");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(select, "5");
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await click("保存");
  };

  it("saves the edit, confirms and returns to the review", async () => {
    mocks.update.mockResolvedValue(entry({ rating: 5, body: "さらに良かった" }));

    await edit();

    expect(mocks.update).toHaveBeenCalledWith("r-1", 5, "さらに良かった");
    expect(mocks.toast).toHaveBeenCalledWith("レビューを更新しました");
    expect(onChanged).toHaveBeenCalled();
    expect(document.querySelector("textarea")).toBeNull();
    expect(text()).toContain("とても丁寧でした");
  });

  it("keeps the form open without a toast when the save fails", async () => {
    mocks.update.mockResolvedValue(null);

    await edit();

    expect(document.querySelector("textarea")).not.toBeNull();
    expect(mocks.toast).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it("lets the cast hide and show the review again", async () => {
    mocks.viewer = "cast-1";
    await mount(entry());
    await click("非表示にする");
    expect(mocks.hide).toHaveBeenCalledWith("r-1");
    expect(mocks.toast).toHaveBeenCalledWith("レビューを非表示にしました");
    expect(onChanged).toHaveBeenCalled();

    document.body.innerHTML = "";
    await mount(entry({ hidden: true }));
    await click("表示に戻す");
    expect(mocks.unhide).toHaveBeenCalledWith("r-1");
    expect(mocks.toast).toHaveBeenCalledWith("レビューを表示に戻しました");
  });
});
