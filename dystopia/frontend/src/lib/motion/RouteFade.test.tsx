// @vitest-environment happy-dom
import { act, createElement, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RouteFade } from "./RouteFade";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(async () => root?.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("RouteFade", () => {
  it("keeps page state when only the transition key changes and cancels obsolete animations", async () => {
    let mounts = 0;
    const cancel = vi.fn();
    const animate = vi.fn(() => ({ cancel, finished: Promise.resolve() }));
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    function Page() { const [text, setText] = useState("draft"); useEffect(() => { mounts++; }, []); return createElement("button", { onClick: () => setText("written") }, text); }
    const container = document.createElement("div"); root = createRoot(container);
    const render = (key: string) => act(async () => root.render(createElement(RouteFade, { transitionKey: key }, createElement(Page))));
    await render("one");
    await act(async () => (container.querySelector("button") as HTMLButtonElement).click());
    await render("two");
    expect(mounts).toBe(1);
    expect(container.textContent).toBe("written");
    expect(animate).toHaveBeenLastCalledWith([{ opacity: 0.55 }, { opacity: 1 }], expect.objectContaining({ duration: 160 }));
    expect(cancel).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    expect(cancel).toHaveBeenCalledTimes(2);
  });
  it("skips the animation for reduced motion", async () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "animate", { configurable: true, value: animate });
    vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(RouteFade, { transitionKey: "one" }, "content")));
    expect(animate).not.toHaveBeenCalled();
  });
});
