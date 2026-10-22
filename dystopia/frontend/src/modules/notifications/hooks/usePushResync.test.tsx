// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.hoisted(() => ({ resyncPushSubscription: vi.fn(async () => {}) }));
vi.mock("@/modules/notifications/lib/push", () => push);

const { usePushResync } = await import("./usePushResync");

function Probe({ accountId }: { accountId: string | null }) {
  usePushResync(accountId);
  return null;
}

describe("usePushResync", () => {
  it("registers the browser's subscription once per signed-in account", async () => {
    const root = createRoot(document.createElement("div"));

    await act(async () => root.render(createElement(Probe, { accountId: null })));
    expect(push.resyncPushSubscription).not.toHaveBeenCalled();

    await act(async () => root.render(createElement(Probe, { accountId: "account-A" })));
    await act(async () => root.render(createElement(Probe, { accountId: "account-A" })));
    expect(push.resyncPushSubscription).toHaveBeenCalledTimes(1);

    await act(async () => root.render(createElement(Probe, { accountId: "account-B" })));
    expect(push.resyncPushSubscription).toHaveBeenCalledTimes(2);

    await act(async () => root.unmount());
  });
});
