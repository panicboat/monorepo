import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

const mocks = vi.hoisted(() => ({
  profile: null as import("@/modules/profile/types").ProfileView | null,
  viewerRole: "guest" as "cast" | "guest",
  search: "",
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ username: "profile_user" }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/modules/profile/hooks", () => ({
  usePublicProfile: () => ({ profile: mocks.profile, loading: false, error: null, mutate: () => {} }),
  useProfile: () => ({ saveProfile: async () => {}, saveMedia: async () => {} }),
}));

vi.mock("@/modules/profile/components/ProfileHeader", () => ({
  ProfileHeader: ({ actions }: { actions?: import("react").ReactNode }) => <header>{actions}</header>,
}));

vi.mock("@/modules/profile/components/EditProfileSheet", () => ({
  EditProfileSheet: () => null,
}));

vi.mock("@/modules/social", () => ({
  SocialCountsLinks: () => <span>social-counts</span>,
  useSocialCounts: () => ({ followingCount: 0, followersCount: 0 }),
}));

vi.mock("./ProfileActions", () => ({
  ProfileActions: ({ targetProfileId }: { targetProfileId: string }) => <span>{`profile-actions:${targetProfileId}`}</span>,
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

vi.mock("@/modules/post/components/ProfileContentTabs", () => ({
  ProfileContentTabs: ({
    leadingTabs,
    extraTabs,
    initialTab,
  }: {
    leadingTabs?: { id: string; label: string }[];
    extraTabs?: { id: string; label: string }[];
    initialTab?: string;
  }) => (
    <div>
      <span>{`initial-tab:${initialTab ?? ""}`}</span>
      {[...(leadingTabs ?? []), ...(extraTabs ?? [])].map((t) => (
        <span key={t.id}>{t.label}</span>
      ))}
    </div>
  ),
}));
vi.mock("@/modules/schedule", () => ({
  ScheduleTab: () => null,
}));

const { default: PublicProfilePage } = await import("./page");

describe("PublicProfilePage layout", () => {
  it("puts the follow-state actions in the header of another profile", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2, isPrivate: true };

    const html = renderToStaticMarkup(<PublicProfilePage />);
    const header = html.match(/<header>(.*?)<\/header>/)?.[1] ?? "";

    expect(header).toBe("<span>profile-actions:profile-1</span>");
  });

  it("puts only the edit action in the header of the viewer's own profile", () => {
    mocks.profile = { ...emptyProfileView("viewer-1"), role: 2 };

    const html = renderToStaticMarkup(<PublicProfilePage />);
    const header = html.match(/<header>(.*?)<\/header>/)?.[1] ?? "";

    expect(header).toContain("プロフィールを編集");
    expect(header).not.toContain("profile-actions");
  });

  it("shows the follow counts right under the header", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain("</header><span>social-counts</span>");
  });
});

describe("PublicProfilePage reviews tab label", () => {
  it("labels the reviews tab plainly on a cast profile", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain(">クチコミ<");
    expect(html).not.toContain("受信クチコミ");
  });

  it("labels the reviews tab plainly on a guest profile", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 1 };

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain(">クチコミ<");
    expect(html).not.toContain("書いたクチコミ");
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

describe("PublicProfilePage tabs", () => {
  it("leads a cast profile with schedules and reviews", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };
    mocks.viewerRole = "guest";
    mocks.search = "";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).toContain(">予定<");
    expect(html.indexOf(">予定<")).toBeLessThan(html.indexOf("クチコミ"));
  });

  it("puts nothing above the tabs, so switching tabs keeps the page in place", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };
    mocks.search = "";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html).not.toContain("今週の予定");
  });

  it("opens the tab named in the URL", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 2 };
    mocks.search = "tab=schedule";

    expect(renderToStaticMarkup(<PublicProfilePage />)).toContain("initial-tab:schedule");
  });

  it("puts the karte tab before reviews on a guest profile seen by a cast", () => {
    mocks.profile = { ...emptyProfileView("profile-1"), role: 1 };
    mocks.viewerRole = "cast";
    mocks.search = "";

    const html = renderToStaticMarkup(<PublicProfilePage />);

    expect(html.indexOf("カルテ")).toBeLessThan(html.indexOf("クチコミ"));
  });
});
