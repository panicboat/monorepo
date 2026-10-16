import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

const mocks = vi.hoisted(() => ({
  profile: null as import("@/modules/profile/types").ProfileView | null,
  viewerRole: "guest" as "cast" | "guest",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ username: "profile_user" }),
}));

vi.mock("@/modules/profile/hooks", () => ({
  usePublicProfile: () => ({ profile: mocks.profile, loading: false, error: null, mutate: () => {} }),
  useProfile: () => ({ saveProfile: async () => {}, saveMedia: async () => {} }),
}));

vi.mock("@/modules/profile/components/ProfileHeader", () => ({
  ProfileHeader: ({ actions }: { actions?: import("react").ReactNode }) => <header>{actions}</header>,
}));

vi.mock("@/modules/profile/components/EditProfileModal", () => ({
  EditProfileModal: () => null,
}));

vi.mock("@/modules/social", () => ({
  FollowButton: () => <span>follow-button</span>,
  ProfileMoreMenu: () => <span>more-menu</span>,
  SocialCountsLinks: () => <span>social-counts</span>,
  useSocialCounts: () => ({ followingCount: 0, followersCount: 0 }),
}));

vi.mock("@/modules/messaging", () => ({
  StartChatButton: () => <span>chat-button</span>,
}));

vi.mock("@/modules/footprints", () => ({
  useRecordVisit: () => () => {},
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector?: (state: { activeProfileId: string; role: string }) => unknown) => {
    const state = { activeProfileId: "viewer-1", role: mocks.viewerRole };
    return selector ? selector(state) : state;
  },
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
  selectRole: (state: { role: string }) => state.role,
}));

vi.mock("@/modules/schedule", () => ({
  ScheduleSection: () => <span>schedule-section</span>,
}));

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

describe("PublicProfilePage layout", () => {
  it("puts the more menu, message and follow actions in the header of another profile", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };

    const html = renderToStaticMarkup(<PublicProfilePage />);
    const header = html.match(/<header>(.*?)<\/header>/)?.[1] ?? "";

    expect(header).toBe("<span>more-menu</span><span>chat-button</span><span>follow-button</span>");
  });

  it("puts only the edit action in the header of the viewer's own profile", () => {
    mocks.profile = { ...emptyProfileView("viewer-1"), role: 2 };

    const html = renderToStaticMarkup(<PublicProfilePage />);
    const header = html.match(/<header>(.*?)<\/header>/)?.[1] ?? "";

    expect(header).toContain("プロフィールを編集");
    expect(header).not.toContain("follow-button");
  });

  it("shows the follow counts right under the header and above the schedule", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain("</header><span>social-counts</span><span>schedule-section</span>");
  });
});

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

describe("PublicProfilePage karte tab visibility", () => {
  it("shows the karte tab on a guest profile to a cast", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 1 };
    mocks.viewerRole = "cast";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain("カルテ");
  });

  it("hides the karte tab on a guest profile from a guest", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 1 };
    mocks.viewerRole = "guest";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).not.toContain("カルテ");
  });

  it("hides the karte tab on a cast profile even from a cast", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };
    mocks.viewerRole = "cast";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).not.toContain("カルテ");
  });
});
