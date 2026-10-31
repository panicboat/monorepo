// @vitest-environment happy-dom
import { act, createElement, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));

const { SideSheet } = await import("./side-sheet");

type Props = Parameters<typeof SideSheet>[0];

const sheet = (props: Partial<Props> & Pick<Props, "onOpenChange">) =>
  createElement(SideSheet, { open: true, title: "カルテを作成", children: createElement("p", null, "本文"), ...props });

const mounted: { root: Root; container: HTMLElement }[] = [];

async function render(element: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ root, container });
  await act(async () => root.render(element));
  return { rerender: (next: ReactElement) => act(async () => root.render(next)) };
}

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
const button = (label: string) => document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement | null;

afterEach(async () => {
  while (mounted.length > 0) {
    const { root, container } = mounted.pop()!;
    await act(async () => root.unmount());
    container.remove();
  }
  navigation.pathname = "/";
});

describe("SideSheet", () => {
  it("shows the title and the content while open", async () => {
    await render(sheet({ onOpenChange: vi.fn() }));

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("カルテを作成");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("本文");
  });

  it("keeps the footer out of the scrolling body and renders no footer area without one", async () => {
    const view = await render(sheet({ onOpenChange: vi.fn(), footer: createElement("p", { id: "footer" }, "フッター") }));

    const footer = document.getElementById("footer") as HTMLElement;
    expect(footer.closest('[role="dialog"]')).not.toBeNull();
    expect(footer.closest("[data-sheet-body]")).toBeNull();

    await view.rerender(sheet({ onOpenChange: vi.fn() }));
    expect(document.querySelector("[data-sheet-body]")?.nextElementSibling).toBeNull();
  });

  it("shows nothing while closed", async () => {
    await render(sheet({ onOpenChange: vi.fn(), open: false }));

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("asks to close from the close button", async () => {
    const onOpenChange = vi.fn();
    await render(sheet({ onOpenChange }));

    await act(async () => button("閉じる")!.click());

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("asks to close on Escape", async () => {
    const onOpenChange = vi.fn();
    await render(sheet({ onOpenChange }));

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("leaves Escape to a combobox whose suggestions are open", async () => {
    const onOpenChange = vi.fn();
    const combobox = (expanded: boolean) => createElement("textarea", { role: "combobox", "aria-expanded": expanded, "aria-label": "本文" });
    const { rerender } = await render(sheet({ onOpenChange, children: combobox(true) }));
    const pressEscape = () =>
      act(async () => {
        document.querySelector('textarea[aria-label="本文"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
      });

    await pressEscape();
    expect(onOpenChange).not.toHaveBeenCalled();

    await rerender(sheet({ onOpenChange, children: combobox(false) }));
    await pressEscape();
    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("asks to close when the page behind it is pressed", async () => {
    const onOpenChange = vi.fn();
    await render(sheet({ onOpenChange }));
    await settle();
    const overlay = document.querySelector("[data-sheet-overlay]") as HTMLElement;

    await act(async () => {
      overlay.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      overlay.click();
    });
    await settle();

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("offers a back button only when a step can be undone", async () => {
    const onBack = vi.fn();
    const view = await render(sheet({ onOpenChange: vi.fn() }));
    expect(button("前に戻る")).toBeNull();

    await view.rerender(sheet({ onOpenChange: vi.fn(), onBack }));
    await act(async () => button("前に戻る")!.click());

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("asks to close when the route changes under it", async () => {
    const onOpenChange = vi.fn();
    const view = await render(sheet({ onOpenChange }));

    navigation.pathname = "/messages/thread-1";
    await view.rerender(sheet({ onOpenChange }));

    expect(onOpenChange.mock.calls).toEqual([[false]]);
  });

  it("returns focus to the element that had it before opening", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const view = await render(sheet({ onOpenChange: vi.fn() }));
    await settle();

    await view.rerender(sheet({ onOpenChange: vi.fn(), open: false }));
    await settle();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("scrolls long content inside the sheet", async () => {
    await render(sheet({ onOpenChange: vi.fn() }));

    const body = document.querySelector("[data-sheet-body]")!.className.split(/\s+/);

    expect(body).toEqual(expect.arrayContaining(["min-h-0", "flex-1", "overflow-y-auto"]));
  });

  it("brings the content in again when the step changes", async () => {
    const view = await render(sheet({ onOpenChange: vi.fn(), stepKey: "pick" }));
    const first = document.querySelector(".animate-sheet-step");

    await view.rerender(sheet({ onOpenChange: vi.fn(), stepKey: "compose" }));

    expect(document.querySelector(".animate-sheet-step")).not.toBe(first);
  });
});
