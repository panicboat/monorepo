// @vitest-environment happy-dom
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SideSheet } from "./side-sheet";
import { readFileSync } from "node:fs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let container: HTMLDivElement;
const close = vi.fn<(open: boolean) => void>();
const internalBack = vi.fn<() => void>();

async function mount() {
  function Probe() {
    const [open, setOpen] = useState(false);
    return createElement("div", null, createElement("button", { onClick: () => setOpen(true), id: "origin" }, "open"), createElement(SideSheet, { open, onOpenChange: (next) => { close(next); setOpen(next); }, title: "カルテ詳細", onBack: internalBack, historyMode: "route", footer: createElement("button", null, "保存"), children: createElement("div", null, createElement("input", { "aria-label": "補足" }), createElement("button", null, "next")) }));
  }
  await act(async () => root.render(createElement(Probe)));
  const origin = container.querySelector("#origin") as HTMLButtonElement;
  origin.focus();
  await act(async () => origin.click());
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
  return origin;
}
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); close.mockReset(); internalBack.mockReset(); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe("SideSheet", () => {
  it("labels the dialog, focuses within it and restores its origin after Esc", async () => {
    const origin = await mount();
    const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(document.getElementById(dialog.getAttribute("aria-labelledby") || "")?.textContent).toBe("カルテ詳細");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(async () => origin.focus());
    expect(dialog.contains(document.activeElement)).toBe(true);
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 5)); });
    expect(close).toHaveBeenCalledWith(false);
    expect(document.activeElement).toBe(origin);
  });
  it("keeps internal Back separate from closing", async () => {
    await mount();
    await act(async () => (document.querySelector('[aria-label="前の画面に戻る"]') as HTMLButtonElement).click());
    expect(internalBack).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    await act(async () => (document.querySelector('[aria-label="閉じる"]') as HTMLButtonElement).click());
    expect(close).toHaveBeenCalledWith(false);
  });
  it("dismisses from a pointer click on the background", async () => {
    await mount();
    await act(async () => (document.querySelector('.side-sheet-overlay') as HTMLElement).dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerType: "mouse" })));
    await act(async () => (document.querySelector('.side-sheet-overlay') as HTMLElement).click());
    expect(close).toHaveBeenCalledWith(false);
  });
  it("keeps the content mounted until its CSS exit animation ends", async () => {
    const style = document.createElement("style");
    style.textContent = readFileSync("src/app/globals.css", "utf8").replace(/@import[^;]+;/g, "");
    document.head.appendChild(style);
    try {
      await mount();
      await act(async () => (document.querySelector('[aria-label="閉じる"]') as HTMLButtonElement).click());
      const dialog = document.querySelector('[role="dialog"]') as HTMLElement;
      expect(dialog).not.toBeNull();
      expect(dialog.dataset.state).toBe("closed");
      const end = new Event("animationend", { bubbles: true });
      Object.defineProperty(end, "animationName", { value: "sheet-exit" });
      await act(async () => dialog.dispatchEvent(end));
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    } finally { style.remove(); }
  });
});
