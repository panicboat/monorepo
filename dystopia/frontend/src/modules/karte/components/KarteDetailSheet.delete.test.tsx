// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetcher: vi.fn(), remove: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/swr", () => ({ fetcher: mocks.fetcher }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "p-1" }),
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: vi.fn() }),
}));
vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({
    updateRating: vi.fn(), close: vi.fn(), reopen: vi.fn(), addEvent: vi.fn(), updateEvent: vi.fn(), removeEvent: vi.fn(),
    remove: mocks.remove, loading: false, error: null,
  }),
}));

const { KarteDetailSheet } = await import("./KarteDetailSheet");
const { revalidateKarte } = await import("../lib/revalidate");

const subject = {
  id: "k-1", authorProfileId: "a", author: { profileId: "a", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" },
  targetProfileId: "g", target: { profileId: "g", username: "hanako", displayName: "はなこ", avatarUrl: "", isPrivate: false, role: "guest" },
  isMine: true, rating: null, status: "open",
  events: [{ id: "e-1", stage: "reservation", outcome: "booked", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" }],
  createdAt: "", updatedAt: "", closedAt: null, lastActivityAt: "",
} as Karte;

afterEach(() => {
  document.body.innerHTML = "";
});

describe("KarteDetailSheet deleting", () => {
  it("does not read the karte again once its deletion has started", async () => {
    mocks.fetcher.mockReset().mockResolvedValue({ karte: subject });
    mocks.remove.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await revalidateKarte();
      return true;
    });
    vi.stubGlobal("confirm", () => true);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(KarteDetailSheet, { karte: subject, open: true, onClose: vi.fn() }))
      );
    });
    mocks.fetcher.mockClear();

    await act(async () => {
      (Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "このカルテを削除") as HTMLButtonElement).click();
    });

    expect(mocks.remove).toHaveBeenCalledWith("k-1");
    expect(mocks.fetcher).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});
