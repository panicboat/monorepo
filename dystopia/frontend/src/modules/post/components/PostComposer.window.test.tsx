// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PostComposer, type PostComposerProps } from "./PostComposer";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const past = (days: number) => future(-days);

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
    expect(payload.publishedAt).toBe(new Date(2026, 9, 25, 9, 0).toISOString());
    expect(payload.expiresAt).toBe(new Date(2026, 9, 26, 18, 30).toISOString());
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

describe("PostComposer display window while editing", () => {
  it("opens the window with an editable start for a scheduled post", async () => {
    await mount({ editing: { publishedAt: future(2), expiresAt: "" } });

    expect(windowSwitch()!.getAttribute("aria-checked")).toBe("true");
    expect(startInput()!.disabled).toBe(false);
    expect(endInput()!.disabled).toBe(false);
  });

  it("locks the start of a live post that has an end", async () => {
    await mount({ editing: { publishedAt: past(2), expiresAt: future(2) } });

    expect(windowSwitch()!.getAttribute("aria-checked")).toBe("true");
    expect(startInput()!.disabled).toBe(true);
    expect(endInput()!.disabled).toBe(false);
  });

  it("keeps the window closed for a live post without an end", async () => {
    await mount({ editing: { publishedAt: past(2), expiresAt: "" } });

    expect(windowSwitch()!.getAttribute("aria-checked")).toBe("false");
    expect(startInput()).toBeNull();
  });

  it("sends the stored end back unchanged and no start for a live post", async () => {
    const expiresAt = "2026-10-01T00:00:45.000Z";
    const onSubmit = await mount({ editing: { publishedAt: "2026-09-01T00:00:30.000Z", expiresAt } });

    await submit();

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.publishedAt).toBeUndefined();
    expect(payload.expiresAt).toBe(expiresAt);
  });

  it("sends no end once the user clears it", async () => {
    const onSubmit = await mount({ editing: { publishedAt: past(2), expiresAt: future(2) } });

    await type(endInput()!, "");
    await submit();

    expect(onSubmit.mock.calls[0][0].expiresAt).toBeUndefined();
  });

  it("sends the stored start back for a scheduled post and none after it is cleared", async () => {
    const publishedAt = future(2);
    const onSubmit = await mount({ editing: { publishedAt, expiresAt: "" } });

    await submit();
    expect(onSubmit.mock.calls[0][0].publishedAt).toBe(publishedAt);

    await type(startInput()!, "");
    await submit();
    expect(onSubmit.mock.calls[1][0].publishedAt).toBeUndefined();
  });

  it("sends no times when the window is switched off, so the post goes live now with no end", async () => {
    const onSubmit = await mount({ editing: { publishedAt: future(2), expiresAt: future(5) } });

    await click(windowSwitch()!);
    await submit();

    const payload = onSubmit.mock.calls[0][0];
    expect(payload.publishedAt).toBeUndefined();
    expect(payload.expiresAt).toBeUndefined();
  });
});
