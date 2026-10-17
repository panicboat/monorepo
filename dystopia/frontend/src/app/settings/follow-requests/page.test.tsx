import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ProfileSummaryView } from "@/modules/profile/types";

const state = vi.hoisted(() => ({ requests: [] as ProfileSummaryView[] }));

vi.mock("@/modules/social", () => ({
  useFollowRequests: () => ({
    requests: state.requests,
    pendingCount: state.requests.length,
    loading: false,
    error: undefined,
    approve: vi.fn(),
    reject: vi.fn(),
  }),
}));

const { default: FollowRequestsPage } = await import("./page");

const requester = (overrides: Partial<ProfileSummaryView> = {}): ProfileSummaryView => ({
  profileId: "p-1", username: "rin", displayName: "りん", avatarUrl: "", isPrivate: false, role: "guest", ...overrides,
});

describe("FollowRequestsPage", () => {
  it("marks a private requester with a lock", () => {
    state.requests = [requester({ isPrivate: true })];

    expect(renderToStaticMarkup(<FollowRequestsPage />)).toContain("鍵付き");
  });

  it("shows no lock for a public requester and falls back to the handle", () => {
    state.requests = [requester({ displayName: "" })];
    const html = renderToStaticMarkup(<FollowRequestsPage />);

    expect(html).not.toContain("鍵付き");
    expect(html).toContain("@rin");
  });
});
