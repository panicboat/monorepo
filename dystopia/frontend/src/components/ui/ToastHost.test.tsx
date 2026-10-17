// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useToastStore } from "@/stores/toastStore";
import { ToastHost } from "./ToastHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLElement;

const say = (message: string) => act(async () => useToastStore.setState({ message }));

beforeEach(async () => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(ToastHost)));
});

afterEach(async () => {
  await act(async () => useToastStore.getState().hide());
  await act(async () => root.unmount());
  container.remove();
});

describe("ToastHost", () => {
  it("shows nothing without a message", () => {
    expect(container.innerHTML).toBe("");
  });

  it("announces the message on a raised surface outlined in the accent", async () => {
    await say("カルテを保存しました");

    const toast = container.querySelector('[role="status"] button')!;

    expect(toast.textContent).toBe("カルテを保存しました");
    expect(toast.className.split(/\s+/)).toEqual(expect.arrayContaining(["bg-bg-elevated", "border-accent", "text-text-primary"]));
  });

  it("stays above the bottom bar on a phone and above an open sheet", async () => {
    await say("保存しました");

    const host = container.querySelector('[role="status"]')!.className.split(/\s+/);

    expect(host).toEqual(expect.arrayContaining(["bottom-[calc(88px+env(safe-area-inset-bottom))]", "md:bottom-6", "z-[60]"]));
  });

  it("goes away when pressed", async () => {
    await say("保存しました");

    await act(async () => container.querySelector("button")!.click());

    expect(container.innerHTML).toBe("");
  });
});
