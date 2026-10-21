// @vitest-environment happy-dom
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FollowStatus } from "@/stub/social/v1/follow_service_pb";

const mocks = vi.hoisted(() => ({
  status: 0,
  approvalRequired: false,
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
    approvalRequired: mocks.approvalRequired,
    follow: vi.fn(),
    unfollow: vi.fn(),
    cancelRequest: vi.fn(),
    loading: false,
  }),
}));

const { FollowButton } = await import("./FollowButton");

const label = (targetProfileId = "target-1") =>
  renderToStaticMarkup(<FollowButton targetProfileId={targetProfileId} />).replace(/<[^>]+>/g, "");

beforeEach(() => {
  mocks.status = FollowStatus.NONE;
  mocks.approvalRequired = false;
});

describe("FollowButton label", () => {
  it("asks to request a follow when the target requires approval", () => {
    mocks.approvalRequired = true;

    expect(label()).toBe("フォローを申請");
  });

  it("offers a plain follow when the target does not require approval", () => {
    expect(label()).toBe("フォロー");
  });

  it("shows a pending request", () => {
    mocks.status = FollowStatus.PENDING;
    mocks.approvalRequired = true;

    expect(label()).toBe("申請中");
  });

  it("shows following once approved, even if the target no longer requires approval", () => {
    mocks.status = FollowStatus.APPROVED;

    expect(label()).toBe("フォロー中");
  });

  it("renders nothing on the viewer's own profile", () => {
    expect(label("viewer-1")).toBe("");
  });
});
