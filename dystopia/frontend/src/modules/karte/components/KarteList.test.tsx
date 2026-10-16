// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Karte } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const opened = vi.hoisted(() => ({ props: null as null | { karte: Karte; open: boolean; onClose: () => void } }));

vi.mock("./KarteCard", () => ({
  KarteCard: ({ karte, onOpen }: { karte: Karte; onOpen: (k: Karte) => void }) => (
    <button type="button" onClick={() => onOpen(karte)}>
      card:{karte.id}
    </button>
  ),
}));
vi.mock("./KarteDetailSheet", () => ({
  KarteDetailSheet: (props: { karte: Karte; open: boolean; onClose: () => void }) => {
    opened.props = props;
    return <div>sheet:{props.karte.id}:{String(props.open)}</div>;
  },
}));

const { KarteList } = await import("./KarteList");

async function mount(props: Partial<Parameters<typeof KarteList>[0]> = {}) {
  const container = document.createElement("div");
  const onLoadMore = vi.fn();
  await act(async () => {
    createRoot(container).render(
      createElement(KarteList, {
        kartes: [{ id: "k-1" } as Karte, { id: "k-2" } as Karte],
        variant: "feed",
        hasMore: false,
        loading: false,
        onLoadMore,
        empty: "カルテはまだありません",
        ...props,
      })
    );
  });
  return { container, onLoadMore };
}

const button = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement;

describe("KarteList", () => {
  it("opens the pressed karte in the detail sheet and closes it", async () => {
    opened.props = null;
    const { container } = await mount();
    expect(container.textContent).not.toContain("sheet:");

    await act(async () => button(container, "card:k-2").click());
    expect(container.textContent).toContain("sheet:k-2:true");

    await act(async () => opened.props!.onClose());
    expect(container.textContent).toContain("sheet:k-2:false");
  });

  it("says when there is nothing and loads more on request", async () => {
    const empty = await mount({ kartes: [] });
    expect(empty.container.textContent).toContain("カルテはまだありません");

    const { container, onLoadMore } = await mount({ hasMore: true });
    await act(async () => button(container, "もっと見る").click());
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("does not say there is nothing while loading", async () => {
    const { container } = await mount({ kartes: [], loading: true });

    expect(container.textContent).toContain("読み込み中…");
    expect(container.textContent).not.toContain("カルテはまだありません");
  });

  it("keeps the cards and hides the loading line while loading more, and blocks another load", async () => {
    const { container, onLoadMore } = await mount({ loading: true, hasMore: true });

    expect(container.textContent).toContain("card:k-1");
    expect(container.textContent).not.toContain("読み込み中…");
    expect(button(container, "もっと見る").disabled).toBe(true);
    await act(async () => button(container, "もっと見る").click());
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
