import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

const mocks = vi.hoisted(() => ({
  profile: null as import("@/modules/profile/types").ProfileView | null,
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ username: "profile_user" }),
}));

vi.mock("@/modules/profile/hooks", () => ({
  usePublicProfile: () => ({ profile: mocks.profile, loading: false, error: null, mutate: () => {} }),
  useProfile: () => ({ saveProfile: async () => {}, saveMedia: async () => {} }),
}));

vi.mock("@/modules/profile/components/ProfileHeader", () => ({
  ProfileHeader: () => null,
}));

vi.mock("@/modules/profile/components/EditProfileModal", () => ({
  EditProfileModal: () => null,
}));

vi.mock("@/modules/social", () => ({
  FollowButton: () => null,
  BlockButton: () => null,
  SocialCountsLinks: () => null,
  useSocialCounts: () => ({ followingCount: 0, followersCount: 0 }),
}));

vi.mock("@/modules/messaging", () => ({
  StartChatButton: () => null,
}));

vi.mock("@/modules/footprints", () => ({
  useRecordVisit: () => () => {},
}));

vi.mock("@/stores/authStore", () => ({
  // Selector-agnostic: satisfies both `useAuthStore(selectUserId)` and `useAuthStore((s) => s.userId)` call sites.
  useAuthStore: (selector?: (state: { userId: string }) => unknown) => {
    const state = { userId: "viewer-1" };
    return selector ? selector(state) : state;
  },
  selectUserId: (state: { userId: string }) => state.userId,
}));

vi.mock("@/modules/karte/hooks/useMyKarteAccess", () => ({
  useMyKarteAccess: () => ({ hasAccess: false, grantedAt: null, loading: false, error: null }),
}));

vi.mock("@/modules/schedule", () => ({
  ScheduleSection: () => null,
}));

// Stubs to extraTabs' labels only, mirroring how the real ProfileContentTabs renders every tab label up front.
vi.mock("@/modules/post/components/ProfileContentTabs", () => ({
  ProfileContentTabs: ({ extraTabs }: { extraTabs?: { id: string; label: string }[] }) => (
    <div>
      {(extraTabs ?? []).map((t) => (
        <span key={t.id}>{t.label}</span>
      ))}
    </div>
  ),
}));

const { default: PublicProfilePage } = await import("./page");

describe("PublicProfilePage reviews tab label", () => {
  it("labels the reviews tab plainly on a cast profile", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain(">レビュー<");
    expect(html).not.toContain("受信レビュー");
  });

  it("labels the reviews tab plainly on a guest profile", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 1 };

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain(">レビュー<");
    expect(html).not.toContain("書いたレビュー");
  });
});
