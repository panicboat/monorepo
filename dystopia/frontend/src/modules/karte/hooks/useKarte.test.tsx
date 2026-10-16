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
let karteId: string | null = "k-1";
function Probe() {
  hook.current = useKarte(karteId, initial);
  return null;
}

const tree = () => createElement(SWRConfig, { value: { provider: () => new Map(), dedupingInterval: 0 } }, createElement(Probe));

async function mount() {
  const root = createRoot(document.createElement("div"));
  await act(async () => {
    root.render(tree());
  });
  return root;
}

beforeEach(() => {
  mocks.fetcher.mockReset();
  karteId = "k-1";
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

  it("shows an applied karte without reading again", async () => {
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 4 } });
    const root = await mount();
    mocks.fetcher.mockClear();

    await act(async () => {
      await hook.current!.apply({ id: "k-1", rating: 5 } as Karte);
    });

    expect(hook.current!.karte).toEqual({ id: "k-1", rating: 5 });
    expect(mocks.fetcher).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });

  it("keeps showing the last karte once there is no id to read", async () => {
    mocks.fetcher.mockResolvedValue({ karte: { id: "k-1", rating: 4 } });
    const root = await mount();
    await act(async () => {
      await hook.current!.apply({ id: "k-1", rating: 5 } as Karte);
    });

    karteId = null;
    await act(async () => {
      root.render(tree());
    });

    expect(hook.current!.karte).toEqual({ id: "k-1", rating: 5 });
    await act(async () => root.unmount());
  });
});
