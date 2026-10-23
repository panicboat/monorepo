// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const push = vi.hoisted(() => ({
  support: "available" as string,
  readPushEnvironment: vi.fn(() => ({})),
  detectPushSupport: vi.fn(() => push.support),
  fetchVapidPublicKey: vi.fn(async () => "BPublicKey"),
  isSubscribedHere: vi.fn(async () => false),
  enablePush: vi.fn(async () => "subscribed"),
  disablePush: vi.fn(async () => {}),
}));
vi.mock("@/modules/notifications/lib/push", () => push);

const { usePushDevice } = await import("./usePushDevice");
const { useAuthStore } = await import("@/stores/authStore");

let latest: ReturnType<typeof usePushDevice>;
let root: ReturnType<typeof createRoot>;

function Probe() {
  latest = usePushDevice();
  return null;
}

async function mount() {
  root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Probe)));
}

beforeEach(() => {
  push.support = "available";
  push.fetchVapidPublicKey.mockReset().mockResolvedValue("BPublicKey");
  push.isSubscribedHere.mockReset().mockResolvedValue(false);
  useAuthStore.setState({ activeProfileId: "profile-A" });
  push.enablePush.mockReset().mockResolvedValue("subscribed");
  push.disablePush.mockReset().mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("usePushDevice", () => {
  it("reports why the device cannot receive notifications", async () => {
    for (const support of ["unsupported", "needs-install", "denied"]) {
      push.support = support;
      await mount();
      expect(latest.state).toBe(support);
      await act(async () => root.unmount());
    }
    push.support = "available";
    push.fetchVapidPublicKey.mockResolvedValue("");
    await mount();
    expect(latest.state).toBe("unconfigured");
  });

  it("is on when the acting profile is subscribed on this browser", async () => {
    push.isSubscribedHere.mockResolvedValue(true);

    await mount();

    expect(latest.state).toBe("on");
  });

  it("checks the subscription again when the acting profile changes", async () => {
    push.isSubscribedHere.mockResolvedValue(true);
    await mount();
    expect(latest.state).toBe("on");

    push.isSubscribedHere.mockResolvedValue(false);
    await act(async () => useAuthStore.setState({ activeProfileId: "profile-B" }));

    expect(push.isSubscribedHere).toHaveBeenCalledTimes(2);
    expect(latest.state).toBe("off");
  });

  it("turns on with the fetched key, and reports a refused permission", async () => {
    await mount();
    expect(latest.state).toBe("off");

    await act(async () => latest.enable());
    expect(push.enablePush).toHaveBeenCalledWith("BPublicKey");
    expect(latest.state).toBe("on");

    push.enablePush.mockResolvedValue("denied");
    await act(async () => latest.disable());
    expect(latest.state).toBe("off");
    await act(async () => latest.enable());
    expect(latest.state).toBe("denied");
  });

  it("stays off when the permission prompt is closed without a choice", async () => {
    await mount();
    push.enablePush.mockResolvedValue("dismissed");

    await act(async () => latest.enable());

    expect(latest.state).toBe("off");
    expect(latest.failed).toBe(false);
  });

  it("keeps the previous state and flags a failure when a change fails", async () => {
    await mount();
    push.enablePush.mockRejectedValue(new Error("offline"));

    await act(async () => latest.enable());

    expect(latest.state).toBe("off");
    expect(latest.failed).toBe(true);
    expect(latest.busy).toBe(false);
  });
});
