// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProfileSummaryView } from "@/modules/profile/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({ requests: [] as ProfileSummaryView[], approveAll: vi.fn().mockResolvedValue(undefined) }));

vi.mock("../hooks/useFollowRequests", () => ({
  useFollowRequests: () => ({
    requests: state.requests,
    pendingCount: state.requests.length,
    loading: false,
    error: undefined,
    approve: vi.fn(),
    reject: vi.fn(),
    approveAll: state.approveAll,
  }),
}));

const { FollowRequestsList } = await import("./FollowRequestsList");

const requester = (id: string): ProfileSummaryView => ({
  profileId: id, username: id, displayName: id, avatarUrl: "", isPrivate: false, role: "guest", industry: "",
});

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => createRoot(container).render(createElement(FollowRequestsList)));
  return container;
}

const approveAllButton = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "すべて承認");

afterEach(() => {
  document.body.innerHTML = "";
  state.approveAll.mockReset().mockResolvedValue(undefined);
  vi.unstubAllGlobals();
});

describe("FollowRequestsList approve all", () => {
  it("approves every request after confirming how many there are", async () => {
    state.requests = [requester("rin"), requester("jiro")];
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);
    const container = await mount();

    await act(async () => approveAllButton(container)!.click());

    expect(confirm).toHaveBeenCalledWith("2 件の申請をすべて承認しますか？");
    expect(state.approveAll).toHaveBeenCalledTimes(1);
  });

  it("does nothing when the confirmation is cancelled", async () => {
    state.requests = [requester("rin")];
    vi.stubGlobal("confirm", () => false);
    const container = await mount();

    await act(async () => approveAllButton(container)!.click());

    expect(state.approveAll).not.toHaveBeenCalled();
  });

  it("offers no approve-all button without requests", async () => {
    state.requests = [];
    const container = await mount();

    expect(approveAllButton(container)).toBeUndefined();
  });
});
