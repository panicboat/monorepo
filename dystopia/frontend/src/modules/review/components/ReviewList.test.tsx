// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { Review } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const opened = vi.hoisted(() => ({ props: null as null | { review: Review; open: boolean; onClose: () => void } }));

vi.mock("./ReviewCard", () => ({
  ReviewCard: ({ review, onOpen }: { review: Review; onOpen: (k: Review) => void }) => (
    <button type="button" onClick={() => onOpen(review)}>
      card:{review.id}
    </button>
  ),
}));
vi.mock("./ReviewDetailSheet", () => ({
  ReviewDetailSheet: (props: { review: Review; open: boolean; onClose: () => void }) => {
    opened.props = props;
    return <div>sheet:{props.review.id}:{String(props.open)}</div>;
  },
}));

const { ReviewList } = await import("./ReviewList");

async function mount(props: Partial<Parameters<typeof ReviewList>[0]> = {}) {
  const container = document.createElement("div");
  const onLoadMore = vi.fn();
  await act(async () => {
    createRoot(container).render(
      createElement(ReviewList, {
        reviews: [{ id: "k-1" } as Review, { id: "k-2" } as Review],
        variant: "feed",
        hasMore: false,
        loading: false,
        onLoadMore,
        empty: "クチコミはまだありません",
        ...props,
      })
    );
  });
  return { container, onLoadMore };
}

const button = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement;

describe("ReviewList", () => {
  it("opens the pressed review in the detail sheet and closes it", async () => {
    opened.props = null;
    const { container } = await mount();
    expect(container.textContent).not.toContain("sheet:");

    await act(async () => button(container, "card:k-2").click());
    expect(container.textContent).toContain("sheet:k-2:true");

    await act(async () => opened.props!.onClose());
    expect(container.textContent).toContain("sheet:k-2:false");
  });

  it("says when there is nothing and loads more on request", async () => {
    const empty = await mount({ reviews: [] });
    expect(empty.container.textContent).toContain("クチコミはまだありません");

    const { container, onLoadMore } = await mount({ hasMore: true });
    await act(async () => button(container, "もっと見る").click());
    expect(onLoadMore).toHaveBeenCalled();
  });

  it("does not say there is nothing while loading", async () => {
    const { container } = await mount({ reviews: [], loading: true });

    expect(container.textContent).toContain("読み込み中…");
    expect(container.textContent).not.toContain("クチコミはまだありません");
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
