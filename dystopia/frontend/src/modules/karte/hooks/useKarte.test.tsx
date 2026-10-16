// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ fetcher: vi.fn() }));
vi.mock("@/lib/swr", () => ({ fetcher: mocks.fetcher }));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "p-1" }),
}));

const { useKarte } = await import("./useKarte");
const { revalidateKarte } = await import("../lib/revalidate");

const initial = { id: "k-1", rating: null } as Karte;
const hook: { current: ReturnType<typeof useKarte> | null } = { current: null };
function Probe() {
  hook.current = useKarte("k-1", initial);
  return null;
}

async function mount() {
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(Probe)));
  });
  return root;
}

beforeEach(() => {
  mocks.fetcher.mockReset();
});

describe("useKarte", () => {
  it("shows the karte it was given, then the one it read", async () => {
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 4 } });
    const root = await mount();

    expect(mocks.fetcher).toHaveBeenCalledWith("/api/karte/k-1");
    expect(hook.current!.karte).toEqual({ id: "k-1", rating: 4 });
    expect(hook.current!.gone).toBe(false);
    await act(async () => root.unmount());
  });

  it("reads again when the karte data is revalidated", async () => {
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 4 } });
    const root = await mount();
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 2 } });

    await act(async () => {
      await revalidateKarte();
    });

    expect(hook.current!.karte).toEqual({ id: "k-1", rating: 2 });
    await act(async () => root.unmount());
  });

  it("reports a karte deleted elsewhere as gone", async () => {
    mocks.fetcher.mockRejectedValue(new AppError("VALIDATION", "Karte not found", 400));
    const root = await mount();

    expect(hook.current!.gone).toBe(true);
    await act(async () => root.unmount());
  });
});
