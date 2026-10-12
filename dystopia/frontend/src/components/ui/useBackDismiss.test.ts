// @vitest-environment happy-dom
import { StrictMode, act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBackDismiss } from "./useBackDismiss";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Sheet({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  useBackDismiss(open, onDismiss);
  return null;
}

const mounted: { root: Root; container: HTMLElement }[] = [];

async function render(element: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(element));
  return { rerender: (next: ReactElement) => act(async () => root.render(next)) };
}

const popped = () => new Promise<void>((resolve) => window.addEventListener("popstate", () => resolve(), { once: true }));
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
const marker = () => (window.history.state as { sideSheet?: number } | null)?.sideSheet;

afterEach(async () => {
  while (mounted.length > 0) {
    const { root, container } = mounted.pop()!;
    await act(async () => root.unmount());
    container.remove();
  }
});

describe("useBackDismiss", () => {
  it("adds one history entry while open and keeps the URL", async () => {
    const entries = window.history.length;
    const href = window.location.href;

    await render(createElement(Sheet, { open: true, onDismiss: vi.fn() }));

    expect(window.history.length).toBe(entries + 1);
    expect(marker()).toBeTypeOf("number");
    expect(window.location.href).toBe(href);
  });

  it("adds a single entry and stays open when effects run twice", async () => {
    const entries = window.history.length;
    const onDismiss = vi.fn();

    await render(createElement(StrictMode, null, createElement(Sheet, { open: true, onDismiss })));
    await settle();

    expect(window.history.length).toBe(entries + 1);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("dismisses when the user goes back", async () => {
    const onDismiss = vi.fn();
    await render(createElement(Sheet, { open: true, onDismiss }));

    const back = popped();
    window.history.back();
    await act(async () => back);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("takes its entry off the history when closed from the UI, without dismissing again", async () => {
    const onDismiss = vi.fn();
    const view = await render(createElement(Sheet, { open: true, onDismiss }));
    const own = marker();

    const back = popped();
    await view.rerender(createElement(Sheet, { open: false, onDismiss }));
    await act(async () => back);

    expect(marker()).not.toBe(own);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("leaves the history alone when a navigation replaced its entry", async () => {
    const view = await render(createElement(Sheet, { open: true, onDismiss: vi.fn() }));
    window.history.replaceState({ replaced: true }, "");
    const back = vi.spyOn(window.history, "back");

    await view.rerender(createElement(Sheet, { open: false, onDismiss: vi.fn() }));

    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("leaves the history alone when it was never opened", async () => {
    const back = vi.spyOn(window.history, "back");

    await render(createElement(Sheet, { open: false, onDismiss: vi.fn() }));

    expect(back).not.toHaveBeenCalled();
    back.mockRestore();
  });
});
