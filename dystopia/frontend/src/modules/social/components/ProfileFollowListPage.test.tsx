import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const navMocks = vi.hoisted(() => ({ useParams: vi.fn() }));
const profileMocks = vi.hoisted(() => ({ usePublicProfile: vi.fn() }));
const authMocks = vi.hoisted(() => ({ activeProfileId: "viewer-1" }));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: authMocks.activeProfileId }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

vi.mock("next/navigation", () => ({
  useParams: navMocks.useParams,
}));

vi.mock("@/modules/profile/hooks", () => ({
  usePublicProfile: profileMocks.usePublicProfile,
}));

vi.mock("./FollowListView", () => ({
  FollowListView: ({ profileId, initialTab, showBlocked }: { profileId?: string; initialTab?: string; showBlocked?: boolean }) => (
    <div data-testid="follow-list-view" data-profile-id={profileId} data-initial-tab={initialTab} data-show-blocked={String(!!showBlocked)} />
  ),
}));

const { ProfileFollowListPage } = await import("./ProfileFollowListPage");

describe("ProfileFollowListPage", () => {
  it("resolves the username param and forwards its profileId and tab to FollowListView", () => {
    navMocks.useParams.mockReturnValue({ username: "yuna" });
    profileMocks.usePublicProfile.mockReturnValue({
      profile: { id: "account-1", displayName: "ゆな", username: "yuna" },
      loading: false,
      error: undefined,
    });

    const html = renderToStaticMarkup(<ProfileFollowListPage initialTab="followers" />);

    expect(profileMocks.usePublicProfile).toHaveBeenCalledWith("yuna");
    expect(html).toContain('data-profile-id="account-1"');
    expect(html).toContain('data-initial-tab="followers"');
    expect(html).toContain("ゆな");
  });

  it("shows a loading state while the profile is resolving", () => {
    navMocks.useParams.mockReturnValue({ username: "yuna" });
    profileMocks.usePublicProfile.mockReturnValue({ profile: null, loading: true, error: undefined });

    const html = renderToStaticMarkup(<ProfileFollowListPage initialTab="following" />);

    expect(html).not.toContain("follow-list-view");
    expect(html).toContain("読み込み中");
  });

  it("shows a not-found state when the profile fails to resolve", () => {
    navMocks.useParams.mockReturnValue({ username: "unknown" });
    profileMocks.usePublicProfile.mockReturnValue({ profile: null, loading: false, error: new Error("nope") });

    const html = renderToStaticMarkup(<ProfileFollowListPage initialTab="following" />);

    expect(html).not.toContain("follow-list-view");
    expect(html).toContain("見つかりませんでした");
  });

  it("offers the blocked tab only on the viewer's own lists", () => {
    navMocks.useParams.mockReturnValue({ username: "yuna" });
    profileMocks.usePublicProfile.mockReturnValue({
      profile: { id: "account-1", displayName: "ゆな", username: "yuna" },
      loading: false,
      error: undefined,
    });

    authMocks.activeProfileId = "account-1";
    const own = renderToStaticMarkup(<ProfileFollowListPage initialTab="following" />);
    authMocks.activeProfileId = "viewer-1";
    const other = renderToStaticMarkup(<ProfileFollowListPage initialTab="following" />);

    expect(own).toContain('data-show-blocked="true"');
    expect(other).toContain('data-show-blocked="false"');
  });
});
