// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import type { ReviewEntry } from "../types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const opened = vi.hoisted(() => ({ props: null as null | { entry: ReviewEntry; open: boolean; onClose: () => void } }));

vi.mock("./ReviewCard", () => ({
  ReviewCard: ({ entry, onOpen }: { entry: ReviewEntry; onOpen: (e: ReviewEntry) => void }) => (
    <button type="button" onClick={() => onOpen(entry)}>
      card:{entry.id}
    </button>
  ),
}));
vi.mock("./ReviewDetailSheet", () => ({
  ReviewDetailSheet: (props: { entry: ReviewEntry; open: boolean; onClose: () => void }) => {
    opened.props = props;
    return <div>sheet:{props.entry.id}:{String(props.entry.hidden)}:{String(props.open)}</div>;
  },
}));

const { ReviewList } = await import("./ReviewList");

const entry = (id: string, hidden = false) => ({ id, hidden }) as ReviewEntry;

describe("ReviewList", () => {
  it("opens the pressed review and shows its latest state after a refresh", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    const render = (entries: ReviewEntry[]) =>
      act(async () => {
        root.render(
          createElement(ReviewList, {
            entries,
            variant: "feed",
            hasMore: false,
            loading: false,
            onLoadMore: vi.fn(),
            onChanged: vi.fn(),
            empty: "まだレビューはありません。",
          })
        );
      });
    await render([entry("r-1"), entry("r-2")]);

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "card:r-2") as HTMLButtonElement).click();
    });
    expect(container.textContent).toContain("sheet:r-2:false:true");

    await render([entry("r-1"), entry("r-2", true)]);
    expect(container.textContent).toContain("sheet:r-2:true:true");

    await act(async () => opened.props!.onClose());
    expect(container.textContent).toContain("sheet:r-2:true:false");
  });

  it("says when there is nothing", async () => {
    const container = document.createElement("div");
    await act(async () => {
      createRoot(container).render(
        createElement(ReviewList, {
          entries: [], variant: "feed", hasMore: false, loading: false, onLoadMore: vi.fn(), onChanged: vi.fn(), empty: "まだレビューはありません。",
        })
      );
    });

    expect(container.textContent).toContain("まだレビューはありません。");
  });
});
