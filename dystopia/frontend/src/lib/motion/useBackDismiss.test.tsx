// @vitest-environment happy-dom
import { act, createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBackDismiss } from "./useBackDismiss";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let back: ReturnType<typeof vi.spyOn>;
function Probe(props: Parameters<typeof useBackDismiss>[0]) { useBackDismiss(props); return null; }
const render = async (open: boolean, onDismiss: () => void, enabled = true) => act(async () => root.render(createElement(Probe, { open, onDismiss, enabled })));

beforeEach(() => { window.history.replaceState({ next: "preserved" }, "", "/karte/my"); back = vi.spyOn(window.history, "back").mockImplementation(() => {}); root = createRoot(document.createElement("div")); });
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); });

describe("panel history ownership", () => {
  it("dismisses with Back without leaving the underlying page or going back twice", async () => {
    const dismiss = vi.fn();
    await render(true, dismiss);
    expect(window.history.state.next).toBe("preserved");
    window.history.replaceState({ next: "preserved" }, "", "/karte/my");
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state })));
    await render(false, dismiss);
    expect(window.location.pathname).toBe("/karte/my");
    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(back).not.toHaveBeenCalled();
  });
  it("owns one same-URL entry and removes it when explicitly closed", async () => {
    const push = vi.spyOn(window.history, "pushState");
    await render(true, vi.fn());
    await render(true, vi.fn());
    expect(push).toHaveBeenCalledTimes(1);
    await render(false, vi.fn());
    expect(back).toHaveBeenCalledTimes(1);
  });
  it("leaves route-panel history to the router", async () => {
    const push = vi.spyOn(window.history, "pushState");
    await render(true, vi.fn(), false);
    await render(false, vi.fn(), false);
    expect(push).not.toHaveBeenCalled();
    expect(back).not.toHaveBeenCalled();
  });
  it("does not remove a different navigation entry on unmount", async () => {
    await render(true, vi.fn());
    window.history.pushState({ route: true }, "", "/search");
    await render(false, vi.fn());
    expect(back).not.toHaveBeenCalled();
  });
  it("does not navigate when the owner disappears during a profile switch", async () => {
    await render(true, vi.fn()); await act(async () => root.unmount());
    expect(back).not.toHaveBeenCalled();
  });
  it("owns one entry when StrictMode rehearses its mount", async () => {
    const push = vi.spyOn(window.history, "pushState");
    await act(async () => root.render(createElement(StrictMode, null, createElement(Probe, { open: true, onDismiss: vi.fn(), enabled: true }))));
    expect(push).toHaveBeenCalledTimes(1);
  });
});
