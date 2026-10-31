// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  status: 0,
  fail: vi.fn(() => Promise.reject(new Error("boom"))),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "viewer-1" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

vi.mock("@/modules/social/hooks", () => ({
  useFollow: () => ({
    status: mocks.status,
    isFollowing: mocks.status === FollowStatus.APPROVED,
    isPending: mocks.status === FollowStatus.PENDING,
    approvalRequired: false,
    follow: mocks.fail,
    unfollow: mocks.fail,
    cancelRequest: mocks.fail,
    loading: false,
  }),
}));

const { FollowButton } = await import("./FollowButton");
const { useToastStore } = await import("@/stores/toastStore");

const click = async () => {
  const container = document.createElement("div");
  await act(async () => createRoot(container).render(<FollowButton targetProfileId="target-1" />));
  await act(async () => container.querySelector("button")!.click());
};

beforeEach(() => {
  useToastStore.setState({ message: null });
  vi.stubGlobal("confirm", () => true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FollowButton failure", () => {
  it.each([
    [FollowStatus.NONE, "フォローできませんでした"],
    [FollowStatus.APPROVED, "フォローを解除できませんでした"],
    [FollowStatus.PENDING, "フォロー申請をキャンセルできませんでした"],
  ])("reports status %s in a toast", async (status, message) => {
    mocks.status = status;

    await click();

    expect(useToastStore.getState().message).toBe(message);
  });
});
