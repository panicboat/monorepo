// @vitest-environment happy-dom
import { act, createElement, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { useViewScope } from "./useViewScope";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>;
let scope: ReturnType<typeof useViewScope>;
function Probe({ active }: { active: boolean }) { const current = useViewScope(active); useLayoutEffect(() => { scope = current; }, [current]); return null; }
afterEach(async () => { await act(async () => root?.unmount()); });
describe("useViewScope", () => {
  it("accepts the current view and invalidates a closed or reopened view", async () => {
    useAuthStore.setState({ accountId: "owner", activeProfileId: "writer" }); root = createRoot(document.createElement("div"));
    const render = (active: boolean) => act(async () => root.render(createElement(Probe, { active })));
    await render(true); const request = scope.capture(); expect(request.isCurrent()).toBe(true);
    await render(false); expect(request.isCurrent()).toBe(false); expect(request.isSameActor()).toBe(true);
    await render(true); expect(request.isCurrent()).toBe(false); expect(scope.capture().isCurrent()).toBe(true);
  });
  it("invalidates a profile switch and an unmounted view", async () => {
    useAuthStore.setState({ accountId: "owner", activeProfileId: "writer" }); root = createRoot(document.createElement("div"));
    await act(async () => root.render(createElement(Probe, { active: true })));
    const request = scope.capture();
    await act(async () => useAuthStore.getState().setActiveProfile("another")); expect(request.isSameActor()).toBe(false);
    const current = scope.capture(); await act(async () => root.unmount()); expect(current.isCurrent()).toBe(false);
  });
});
