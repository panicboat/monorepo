// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowerMenu } from "./flower-menu";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const items = [
  { id: "post", label: "投稿", icon: "P" },
  { id: "message", label: "メッセージ", icon: "M" },
  { id: "karte", label: "カルテ", icon: "K" },
];

let container: HTMLDivElement;
let unmount: () => Promise<void>;
let onSelect: ReturnType<typeof vi.fn<(id: string) => void>>;

const trigger = () => container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
const petal = (label: string) =>
  Array.from(container.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent?.includes(label)) as HTMLButtonElement;
const isOpen = () => trigger().getAttribute("aria-expanded") === "true";

function pointer(type: string, x: number, y: number) {
  return act(async () => {
    trigger().dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
  });
}

beforeEach(async () => {
  onSelect = vi.fn<(id: string) => void>();
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  await act(async () => {
    root.render(
      createElement(FlowerMenu, { items, spread: "up-left", radius: 96, label: "作成メニュー", onSelect, children: "＋" })
    );
  });
  // The trigger sits with its centre at (300, 500) for the gesture tests.
  trigger().getBoundingClientRect = () => ({ left: 272, top: 472, width: 56, height: 56 }) as DOMRect;
});

afterEach(async () => {
  await unmount();
});

describe("FlowerMenu", () => {
  it("renders closed, with its petals out of reach of the keyboard", () => {
    const html = renderToStaticMarkup(
      <FlowerMenu items={items} spread="up-left" radius={96} label="作成メニュー" onSelect={() => {}}>
        ＋
      </FlowerMenu>
    );

    expect(html).toContain('aria-expanded="false"');
    expect(html.match(/role="menuitem" tabindex="-1"/g)).toHaveLength(3);
  });

  it("stays open after a tap on the trigger, and selects the petal that is tapped next", async () => {
    await pointer("pointerdown", 300, 500);
    await pointer("pointerup", 300, 500);
    expect(isOpen()).toBe(true);

    await act(async () => {
      petal("メッセージ").click();
    });

    expect(onSelect.mock.calls).toEqual([["message"]]);
    expect(isOpen()).toBe(false);
  });

  it("selects the petal the pointer is released on after sliding from the trigger", async () => {
    await pointer("pointerdown", 300, 500);
    await pointer("pointermove", 300, 410);
    expect(petal("投稿").className).toContain("bg-gradient-brand");

    await pointer("pointerup", 300, 410);

    expect(onSelect.mock.calls).toEqual([["post"]]);
    expect(isOpen()).toBe(false);
  });

  it("closes on a second tap on the trigger without selecting", async () => {
    await pointer("pointerdown", 300, 500);
    await pointer("pointerup", 300, 500);
    await pointer("pointerdown", 300, 500);
    await pointer("pointerup", 300, 500);

    expect(isOpen()).toBe(false);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("stays open when a slide ends away from every petal", async () => {
    await pointer("pointerdown", 300, 500);
    await pointer("pointermove", 300, 410);
    await pointer("pointermove", 420, 620);
    await pointer("pointerup", 420, 620);

    expect(isOpen()).toBe(true);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("closes on Escape and on a tap outside", async () => {
    await pointer("pointerdown", 300, 500);
    await pointer("pointerup", 300, 500);
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(isOpen()).toBe(false);

    await pointer("pointerdown", 300, 500);
    await pointer("pointerup", 300, 500);
    await act(async () => {
      (container.querySelector('[aria-hidden="true"]') as HTMLElement).click();
    });
    expect(isOpen()).toBe(false);
  });

  it("opens and closes from the keyboard", async () => {
    await act(async () => {
      trigger().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    });
    expect(isOpen()).toBe(true);
    expect(petal("投稿").tabIndex).toBe(0);
  });
});
