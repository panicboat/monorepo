// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PostComposer, type PostComposerProps } from "./PostComposer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

async function mount(props: Partial<PostComposerProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(PostComposer, { onSubmit, initialContent: "こんにちは", ...props }));
  });
  return onSubmit;
}

const windowSwitch = () => container!.querySelector('[role="switch"][aria-label="表示期間を指定"]') as HTMLButtonElement | null;
const startInput = () => container!.querySelector('input[aria-label="表示開始"]') as HTMLInputElement | null;
const endInput = () => container!.querySelector('input[aria-label="表示終了"]') as HTMLInputElement | null;

async function click(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function type(el: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    container!.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("PostComposer display window", () => {
  it("hides the start and end until the window is switched on", async () => {
    await mount();

    expect(windowSwitch()).not.toBeNull();
    expect(container!.textContent).toContain("表示期間を指定");
    expect(startInput()).toBeNull();
    expect(endInput()).toBeNull();

    await click(windowSwitch()!);

    expect(startInput()).not.toBeNull();
    expect(endInput()).not.toBeNull();
    expect(container!.textContent).toContain("表示開始");
    expect(container!.textContent).toContain("表示終了");
  });

  it("sends the filled start and end as ISO 8601 instants", async () => {
    const onSubmit = await mount();

    await click(windowSwitch()!);
    await type(startInput()!, "2026-10-25T09:00");
    await type(endInput()!, "2026-10-26T18:30");
    await submit();

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.publishedAt).toBe("2026-10-25T00:00:00.000Z");
    expect(payload.expiresAt).toBe("2026-10-26T09:30:00.000Z");
  });

  it("sends no times when the window is switched off again", async () => {
    const onSubmit = await mount();

    await click(windowSwitch()!);
    await type(startInput()!, "2026-10-25T09:00");
    await type(endInput()!, "2026-10-26T18:30");
    await click(windowSwitch()!);
    await submit();

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.publishedAt).toBeUndefined();
    expect(payload.expiresAt).toBeUndefined();
  });

  it("sends no times for a post that never opened the window", async () => {
    const onSubmit = await mount();

    await submit();

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.publishedAt).toBeUndefined();
    expect(payload.expiresAt).toBeUndefined();
  });
});
