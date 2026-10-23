// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  current: null as Karte | null,
  gone: false,
  apply: vi.fn(),
  toast: vi.fn(),
  mutations: {
    updateRating: vi.fn(),
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("../hooks/useKarte", async () => {
  const { useState } = await import("react");
  return {
    useKarte: () => {
      const [karte, setKarte] = useState(mocks.current);
      const apply = (next: Karte) => {
        mocks.apply(next);
        setKarte(next);
      };
      return { karte, gone: mocks.gone, error: undefined, refresh: vi.fn(), apply };
    },
  };
});
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
  author: { profileId: "persona-a", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast", industry: "" },
  targetProfileId: "guest-1",
  target: { profileId: "guest-1", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest", industry: "" },
  isMine: true,
  rating: null,
  events: [event("e-1"), event("e-2", { stage: "service", outcome: "ended_early", tags: [], note: "30分で帰った", occurredOn: "2026-10-14" })],
  createdAt: "",
  updatedAt: "",
  lastActivityAt: "",
  ...overrides,
});

let root: Root;
let onClose: Mock<() => void>;
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
  mocks.apply.mockReset();
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
  it("shows the karte's author and every event in order under a plain heading", async () => {
    await mount(karte());

    expect(text()).toContain("カルテの詳細");
    expect(document.querySelector("p.tracking-wide")?.textContent).toBe("KARTE");
    expect(text()).not.toContain("記録中");
    expect(text()).toContain("@hanako · 記録者 ゆな");
    expect(text()).toContain("予約から接客後までの記録");
    expect(text().indexOf("予約成立")).toBeLessThan(text().indexOf("途中終了"));
    expect(text()).toContain("30分で帰った");
    expect(text()).toContain("連絡が円滑");
  });

  it("names a missing author as an invalid cast and a missing target as an invalid guest", async () => {
    await mount(karte({ author: null, target: null }));

    expect(text()).toContain("（無効なゲスト）");
    expect(text()).toContain("記録者 （無効なキャスト）");
    expect(text()).not.toContain("@");
    expect(document.querySelector(".rounded-full")?.textContent).toBe("?");
  });

  it("explains that a star makes the karte count toward the average", async () => {
    await mount(karte());
    expect(text()).toContain("星を付けると平均評価に反映されます");

    await act(async () => root.unmount());
    document.body.innerHTML = "";
    await mount(karte({ rating: 4 }));
    expect(text()).toContain("平均評価に反映されています");
    expect(text()).not.toContain("星を付けると");
  });

  it("switches the explanation once a star is chosen on an unrated karte", async () => {
    mocks.mutations.updateRating.mockResolvedValue(karte({ rating: 4 }));
    await mount(karte());
    expect(text()).toContain("星を付けると平均評価に反映されます");

    await click("4つ星");

    expect(mocks.apply).toHaveBeenCalledWith(expect.objectContaining({ rating: 4 }));
    expect(text()).toContain("平均評価に反映されています");
    expect(text()).not.toContain("星を付けると");
  });

  it("gives the author the rating, event edits, appending and deleting with no completing or reopening", async () => {
    await mount(karte({ rating: 4 }));

    expect(button("4つ星")).toBeDefined();
    expect(button("＋ 段階を追記する")).toBeDefined();
    expect(Array.from(document.querySelectorAll("button")).filter((b) => b.textContent === "編集")).toHaveLength(2);
    expect(button("完了する")).toBeUndefined();
    expect(button("再オープン")).toBeUndefined();
    expect(button("このカルテを削除")).toBeDefined();
  });

  it("gives another cast no operations", async () => {
    await mount(karte({ isMine: false }));

    expect(button("4つ星")).toBeUndefined();
    expect(button("編集")).toBeUndefined();
    expect(button("＋ 段階を追記する")).toBeUndefined();
    expect(button("このカルテを削除")).toBeUndefined();
  });

  it("saves a rating from the stars", async () => {
    await mount(karte());

    await click("4つ星");

    expect(mocks.mutations.updateRating).toHaveBeenCalledWith("k-1", 4);
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
    mocks.mutations.removeEvent.mockResolvedValue({ karte: karte() });
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

    expect(confirmDialog).toHaveBeenCalledWith("このカルテを削除しますか？出来事もすべて削除されます。");
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
