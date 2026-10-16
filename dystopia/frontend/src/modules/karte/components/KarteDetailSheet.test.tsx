// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  current: null as Karte | null,
  gone: false,
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
vi.mock("../hooks/useKarte", () => ({ useKarte: () => ({ karte: mocks.current, gone: mocks.gone, error: undefined, refresh: vi.fn() }) }));
vi.mock("../hooks/useKarteMutations", () => ({ useKarteMutations: () => ({ ...mocks.mutations, loading: false, error: null }) }));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));

const { KarteDetailSheet } = await import("./KarteDetailSheet");

const event = (id: string, overrides: Partial<Karte["events"][number]> = {}): Karte["events"][number] => ({
  id, stage: "reservation", outcome: "booked", tags: ["smooth_contact"], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "", ...overrides,
});

const karte = (overrides: Partial<Karte> = {}): Karte => ({
  id: "k-1",
  authorProfileId: "persona-a",
  authorUsername: "yuna",
  authorDisplayName: "ゆな",
  authorAvatarUrl: "",
  targetProfileId: "guest-1",
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
let onClose: ReturnType<typeof vi.fn>;
const confirmDialog = vi.fn();

async function mount(subject: Karte) {
  mocks.current = subject;
  onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(KarteDetailSheet, { karte: subject, open: true, onClose }));
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
  for (const fn of Object.values(mocks.mutations)) fn.mockReset().mockResolvedValue(karte());
  mocks.mutations.remove.mockResolvedValue(true);
  vi.stubGlobal("confirm", confirmDialog);
  confirmDialog.mockReset().mockReturnValue(true);
});

afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
});

describe("KarteDetailSheet", () => {
  it("shows the karte's state, author and every event in order", async () => {
    await mount(karte());

    expect(text()).toContain("カルテの詳細");
    expect(text()).toContain("KARTE / 記録中");
    expect(text()).toContain("@hanako · 記録者 ゆな");
    expect(text()).toContain("記録中のため平均評価には含まれません");
    expect(text()).toContain("予約から接客後までの記録");
    expect(text().indexOf("予約成立")).toBeLessThan(text().indexOf("途中終了"));
    expect(text()).toContain("30分で帰った");
    expect(text()).toContain("連絡が円滑");
  });

  it("gives the author of an open karte the rating, event edits, appending and closing", async () => {
    await mount(karte());

    expect(button("4つ星")).toBeDefined();
    expect(button("＋ 段階を追記する")).toBeDefined();
    expect(Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "編集")).toHaveLength(2);
    expect(button("完了する")!.disabled).toBe(true);
    expect(text()).toContain("完了するには星を選んでください");
    expect(button("このカルテを削除")).toBeDefined();
  });

  it("gives another cast no operations", async () => {
    await mount(karte({ isMine: false }));

    expect(button("4つ星")).toBeUndefined();
    expect(button("編集")).toBeUndefined();
    expect(button("＋ 段階を追記する")).toBeUndefined();
    expect(button("完了する")).toBeUndefined();
    expect(button("このカルテを削除")).toBeUndefined();
  });

  it("gives the author of a closed karte reopening and deleting only", async () => {
    await mount(karte({ status: "closed", rating: 4, closedAt: "2026-10-15T00:00:00Z" }));

    expect(text()).toContain("KARTE / 完了");
    expect(text()).toContain("完了済みの評価は平均に反映されます");
    expect(button("再オープン")).toBeDefined();
    expect(button("編集")).toBeUndefined();
    expect(button("4つ星")).toBeUndefined();
    expect(button("このカルテを削除")).toBeDefined();
  });

  it("keeps the only event from being deleted and says why", async () => {
    await mount(karte({ events: [event("e-1")] }));

    expect(button("削除")!.disabled).toBe(true);
    expect(text()).toContain("出来事は 1 件以上必要です");
  });

  it("saves a rating from the stars", async () => {
    await mount(karte());

    await click("4つ星");

    expect(mocks.mutations.updateRating).toHaveBeenCalledWith("k-1", 4);
  });

  it("closes a rated karte in place and confirms it", async () => {
    await mount(karte({ rating: 4 }));

    await click("完了する");

    expect(mocks.mutations.close).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("カルテを完了しました。平均評価へ反映します");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reopens a closed karte and confirms it", async () => {
    await mount(karte({ status: "closed", rating: 4, closedAt: "2026-10-15T00:00:00Z" }));

    await click("再オープン");

    expect(mocks.mutations.reopen).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("カルテを再オープンしました。集計から一時除外します");
  });

  it("appends a stage in a step of the sheet and comes back", async () => {
    await mount(karte());

    await click("＋ 段階を追記する");
    expect(text()).toContain("カルテに追記");
    expect(text()).toContain("@hanako · すべてのキャストに共有");

    await click("この段階を追記");
    expect(mocks.mutations.addEvent).toHaveBeenCalledWith("k-1", expect.objectContaining({ stage: "reservation", outcome: "inquiry_only" }));
    expect(mocks.toast).toHaveBeenCalledWith("カルテに追記しました");
    expect(text()).toContain("予約から接客後までの記録");
  });

  it("goes back from the append step without saving", async () => {
    await mount(karte());

    await click("＋ 段階を追記する");
    await click("前に戻る");

    expect(text()).toContain("予約から接客後までの記録");
    expect(mocks.mutations.addEvent).not.toHaveBeenCalled();
  });

  it("edits an event with its values filled in", async () => {
    await mount(karte());

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
    await mount(karte());

    await act(async () => {
      Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "削除")[0].click();
    });

    expect(mocks.mutations.removeEvent).toHaveBeenCalledWith("e-1");
    expect(mocks.toast).toHaveBeenCalledWith("出来事を削除しました");
  });

  it("deletes the karte after confirming and closes", async () => {
    await mount(karte());

    await click("このカルテを削除");

    expect(confirmDialog).toHaveBeenCalledWith("このカルテを削除しますか？");
    expect(mocks.mutations.remove).toHaveBeenCalledWith("k-1");
    expect(mocks.toast).toHaveBeenCalledWith("カルテを削除しました");
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the karte was deleted elsewhere", async () => {
    mocks.gone = true;
    await mount(karte());

    expect(onClose).toHaveBeenCalled();
  });
});
