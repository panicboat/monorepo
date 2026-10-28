// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn() }));

vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: { getState: () => ({ activeProfileId: "viewer-1" }) },
}));

const { useFollow } = await import("./useFollow");

let current: ReturnType<typeof useFollow>;
let unmount: () => Promise<void>;

async function mountFor(targetProfileId: string) {
  const Probe = () => {
    current = useFollow(targetProfileId);
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

beforeEach(() => {
  mocks.authFetch.mockReset();
});

afterEach(async () => {
  await unmount();
});

describe("useFollow approvalRequired", () => {
  it("reports that the target requires approval from the status response", async () => {
    mocks.authFetch.mockResolvedValue({
      statuses: { "target-1": FollowStatus.NONE },
      approvalRequired: { "target-1": true },
    });

    await mountFor("target-1");

    expect(current.approvalRequired).toBe(true);
    expect(current.status).toBe(FollowStatus.NONE);
  });

  it("reports no approval requirement when the response leaves the target out", async () => {
    mocks.authFetch.mockResolvedValue({ statuses: { "target-1": FollowStatus.APPROVED }, approvalRequired: {} });

    await mountFor("target-1");

    expect(current.approvalRequired).toBe(false);
    expect(current.isFollowing).toBe(true);
  });

  it("defaults to no approval requirement when the response has no map", async () => {
    mocks.authFetch.mockResolvedValue({ statuses: {} });

    await mountFor("target-1");

    expect(current.approvalRequired).toBe(false);
  });
});

describe("useFollow status", () => {
  it("fetches the status of every button mounted together in one request", async () => {
    mocks.authFetch.mockResolvedValue({
      statuses: { "target-1": FollowStatus.APPROVED, "target-2": FollowStatus.PENDING },
      approvalRequired: { "target-2": true },
    });
    const statuses: Record<string, ReturnType<typeof useFollow>> = {};
    const Probe = ({ targetProfileId }: { targetProfileId: string }) => {
      statuses[targetProfileId] = useFollow(targetProfileId);
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
      root.render(["target-1", "target-2"].map((id) => createElement(Probe, { key: id, targetProfileId: id })));
    });

    expect(mocks.authFetch).toHaveBeenCalledTimes(1);
    expect(mocks.authFetch).toHaveBeenCalledWith("/api/social/follow/status", {
      method: "POST",
      body: { targetProfileIds: ["target-1", "target-2"] },
    });
    expect(statuses["target-1"].isFollowing).toBe(true);
    expect(statuses["target-2"].isPending).toBe(true);
    expect(statuses["target-2"].approvalRequired).toBe(true);
  });
});
