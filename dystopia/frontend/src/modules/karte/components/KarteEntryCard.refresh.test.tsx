// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mutations = vi.hoisted(() => ({ close: vi.fn(), remove: vi.fn() }));

vi.mock("../hooks/useKarteMutations", () => ({
  useKarteMutations: () => ({
    updateRating: vi.fn(),
    close: mutations.close,
    reopen: vi.fn(),
    addEvent: vi.fn(),
    remove: mutations.remove,
    loading: false,
    error: new Error("failed"),
  }),
}));

const { KarteEntryCard } = await import("./KarteEntryCard");

const karte: import("../types").Karte = {
  id: "k-1",
  authorProfileId: "persona-a",
  authorUsername: "persona_a",
  authorAvatarUrl: "",
  targetProfileId: "target-1",
  targetUsername: "guest_hanako",
  targetAvatarUrl: "",
  isMine: true,
  rating: 4,
  status: "open",
  events: [{ id: "e-1", stage: "service", outcome: "completed", tags: [], note: "", occurredOn: "2026-10-01", createdAt: "", updatedAt: "" }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  closedAt: null,
};

async function mount(onChanged: () => void) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(KarteEntryCard, { karte, mode: "my", onChanged }));
  });
  return { container, root };
}

const buttonLabelled = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement;

describe("KarteEntryCard after a failed operation", () => {
  it("asks the list to refresh and keeps showing the error when closing fails", async () => {
    mutations.close.mockResolvedValue(null);
    const onChanged = vi.fn();
    const { container, root } = await mount(onChanged);

    await act(async () => {
      buttonLabelled(container, "完了する").click();
    });

    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("failed");
    await act(async () => root.unmount());
    container.remove();
  });

  it("asks the list to refresh when deleting fails", async () => {
    mutations.remove.mockResolvedValue(false);
    vi.stubGlobal("confirm", () => true);
    const onChanged = vi.fn();
    const { container, root } = await mount(onChanged);

    await act(async () => {
      buttonLabelled(container, "削除").click();
    });

    expect(onChanged).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    await act(async () => root.unmount());
    container.remove();
  });
});
