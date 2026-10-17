// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Review } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  current: null as Review | null,
  gone: false,
  apply: vi.fn(),
  toast: vi.fn(),
  mutations: {
    updateRating: vi.fn(),
    close: vi.fn(),
    reopen: vi.fn(),
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("../hooks/useReview", () => ({ useReview: () => ({ review: mocks.current, gone: mocks.gone, error: undefined, refresh: vi.fn(), apply: mocks.apply }) }));
vi.mock("../hooks/useReviewMutations", () => ({ useReviewMutations: () => ({ ...mocks.mutations, loading: false, error: null }) }));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));

const { ReviewDetailSheet } = await import("./ReviewDetailSheet");

const event = (id: string, overrides: Partial<Review["events"][number]> = {}): Review["events"][number] => ({
  id, stage: "reservation", outcome: "booked", tags: ["quick_reply"], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "", ...overrides,
});

const review = (overrides: Partial<Review> = {}): Review => ({
  id: "k-1",
  authorProfileId: "persona-a",
  authorUsername: "yuna",
  authorDisplayName: "ゆな",
  authorAvatarUrl: "",
  targetProfileId: "cast-1",
  targetUsername: "hanako",
  targetDisplayName: "はなこ",
  targetAvatarUrl: "",
  isMine: true,
  rating: null,
  status: "open",
  events: [event("e-1"), event("e-2", { stage: "service", outcome: "ended_early", tags: [], note: "30分で帰った", occurredOn: "2026-10-14" })],
  createdAt: "",
  updatedAt: "",
  closedAt: null,
  lastActivityAt: "",
  ...overrides,
});

let root: Root;
let onClose: Mock<() => void>;
const confirmDialog = vi.fn();

async function mount(subject: Review) {
  mocks.current = subject;
  onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(ReviewDetailSheet, { review: subject, open: true, onClose }));
  });
}

const text = () => document.body.textContent ?? "";
const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label || b.getAttribute("aria-label") === label) as HTMLButtonElement | undefined;
const click = async (label: string) => {
  await act(async () => {
    button(label)!.click();
  });
};

beforeEach(() => {
  mocks.gone = false;
  mocks.toast.mockReset();
  mocks.apply.mockReset();
  for (const fn of Object.values(mocks.mutations)) fn.mockReset().mockResolvedValue(review());
  mocks.mutations.remove.mockResolvedValue(true);
  vi.stubGlobal("confirm", confirmDialog);
  confirmDialog.mockReset().mockReturnValue(true);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("ReviewDetailSheet", () => {
  it("shows the review's state, author and every event in order", async () => {
    await mount(review());

    expect(text()).toContain("クチコミの詳細");
    expect(text()).toContain("クチコミ / 記録中");
    expect(text()).toContain("@hanako · 書いた人 ゆな");
    expect(text()).toContain("記録中のため平均評価には含まれません");
    expect(text()).toContain("予約から利用後までの記録");
    expect(text().indexOf("予約成立")).toBeLessThan(text().indexOf("途中で終了"));
    expect(text()).toContain("30分で帰った");
    expect(text()).toContain("返信が早い");
  });

  it("gives the author of an open review the rating, event edits, appending and closing", async () => {
    await mount(review());

    expect(button("4つ星")).toBeDefined();
    expect(button("＋ 段階を追記する")).toBeDefined();
    expect(Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "編集")).toHaveLength(2);
    expect(button("完了する")!.disabled).toBe(true);
    expect(text()).toContain("完了するには星を選んでください");
    expect(button("このクチコミを削除")).toBeDefined();
  });

  it("gives another cast no operations", async () => {
    await mount(review({ isMine: false }));

    expect(button("4つ星")).toBeUndefined();
    expect(button("編集")).toBeUndefined();
    expect(button("＋ 段階を追記する")).toBeUndefined();
    expect(button("完了する")).toBeUndefined();
    expect(button("このクチコミを削除")).toBeUndefined();
  });

  it("gives the author of a closed review reopening and deleting only", async () => {
    await mount(review({ status: "closed", rating: 4, closedAt: "2026-10-15T00:00:00Z" }));

    expect(text()).toContain("クチコミ / 完了");
    expect(text()).toContain("完了済みの評価は平均に反映されます");
    expect(button("再オープン")).toBeDefined();
    expect(button("編集")).toBeUndefined();
    expect(button("4つ星")).toBeUndefined();
    expect(button("このクチコミを削除")).toBeDefined();
  });

  it("keeps the only event from being deleted and says why", async () => {
    await mount(review({ events: [event("e-1")] }));

    expect(button("削除")!.disabled).toBe(true);
    expect(text()).toContain("出来事は 1 件以上必要です");
  });

  it("saves a rating from the stars", async () => {
    await mount(review());

    await click("4つ星");

    expect(mocks.mutations.updateRating).toHaveBeenCalledWith("k-1", 4);
  });

  it("closes a rated review in place and confirms it", async () => {
    const closed = review({ rating: 4, status: "closed", closedAt: "2026-10-16T00:00:00Z" });
    mocks.mutations.close.mockResolvedValue(closed);
    await mount(review({ rating: 4 }));

    await click("完了する");

    expect(mocks.mutations.close).toHaveBeenCalledWith("k-1");
    expect(mocks.apply).toHaveBeenCalledWith(closed);
    expect(mocks.toast).toHaveBeenCalledWith("クチコミを完了しました。平均評価へ反映します");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reopens a closed review and confirms it", async () => {
    await mount(review({ status: "closed", rating: 4, closedAt: "2026-10-15T00:00:00Z" }));

    await click("再オープン");

    expect(mocks.mutations.reopen).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("クチコミを再オープンしました。集計から一時除外します");
  });

  it("appends a stage in a step of the sheet and comes back", async () => {
    await mount(review());

    await click("＋ 段階を追記する");
    expect(text()).toContain("クチコミに追記");
    expect(text()).toContain("@hanako · 全員に公開");

    await click("この段階を追記");
    expect(mocks.mutations.addEvent).toHaveBeenCalledWith("k-1", expect.objectContaining({ stage: "reservation", outcome: "inquiry_only" }));
    expect(mocks.toast).toHaveBeenCalledWith("クチコミに追記しました");
    expect(text()).toContain("予約から利用後までの記録");
  });

  it("goes back from the append step without saving", async () => {
    await mount(review());

    await click("＋ 段階を追記する");
    await click("前に戻る");

    expect(text()).toContain("予約から利用後までの記録");
    expect(mocks.mutations.addEvent).not.toHaveBeenCalled();
  });

  it("edits an event with its values filled in", async () => {
    await mount(review());

    await act(async () => {
      Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "編集")[1].click();
    });
    expect(text()).toContain("出来事を編集");
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("30分で帰った");

    await click("出来事を更新");
    expect(mocks.mutations.updateEvent).toHaveBeenCalledWith("e-2", expect.objectContaining({ stage: "service", outcome: "ended_early", note: "30分で帰った" }));
    expect(mocks.toast).toHaveBeenCalledWith("出来事を更新しました");
  });

  it("deletes an event after confirming", async () => {
    await mount(review());

    await act(async () => {
      Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "削除")[0].click();
    });

    expect(mocks.mutations.removeEvent).toHaveBeenCalledWith("e-1");
    expect(mocks.toast).toHaveBeenCalledWith("出来事を削除しました");
  });

  it("deletes the review after confirming and closes", async () => {
    await mount(review());

    await click("このクチコミを削除");

    expect(confirmDialog).toHaveBeenCalledWith("このクチコミを削除しますか？");
    expect(mocks.mutations.remove).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("クチコミを削除しました");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the review was deleted elsewhere", async () => {
    mocks.gone = true;
    await mount(review());

    expect(onClose).toHaveBeenCalled();
  });
});
