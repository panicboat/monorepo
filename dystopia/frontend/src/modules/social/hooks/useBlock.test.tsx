// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  blocked: false,
}));

vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: { getState: () => ({ activeProfileId: "viewer-1" }) },
}));

const { useBlock } = await import("./useBlock");

let current: ReturnType<typeof useBlock>;
let unmount: () => Promise<void>;

async function mountFor(targetProfileId: string) {
  const Probe = () => {
    current = useBlock(targetProfileId);
    return null;
  };
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  unmount = async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
  await act(async () => {
    root.render(createElement(Probe));
  });
}

const writes = () => mocks.authFetch.mock.calls.filter(([url]) => url !== "/api/social/blocks/status");

beforeEach(() => {
  mocks.authFetch.mockReset();
  mocks.authFetch.mockImplementation(async (url: string) =>
    url === "/api/social/blocks/status" ? { blocked: { "target-1": mocks.blocked } } : {}
  );
});

afterEach(async () => {
  await unmount();
  vi.unstubAllGlobals();
});

describe("useBlock toggle", () => {
  it("blocks a profile that is not blocked once the viewer confirms", async () => {
    mocks.blocked = false;
    vi.stubGlobal("confirm", () => true);
    await mountFor("target-1");

    await act(async () => {
      await current.toggle();
    });

    expect(writes()).toEqual([["/api/social/blocks", { method: "POST", body: { targetProfileId: "target-1" } }]]);
    expect(current.isBlocked).toBe(true);
  });

  it("unblocks a blocked profile once the viewer confirms", async () => {
    mocks.blocked = true;
    vi.stubGlobal("confirm", () => true);
    await mountFor("target-1");

    await act(async () => {
      await current.toggle();
    });

    expect(writes()).toEqual([["/api/social/blocks?target_profile_id=target-1", { method: "DELETE" }]]);
    expect(current.isBlocked).toBe(false);
  });

  it("changes nothing when the viewer declines the confirmation", async () => {
    mocks.blocked = false;
    vi.stubGlobal("confirm", () => false);
    await mountFor("target-1");

    await act(async () => {
      await current.toggle();
    });

    expect(writes()).toEqual([]);
    expect(current.isBlocked).toBe(false);
  });
});
