import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/modules/profile/hooks", () => ({
  useProfile: () => ({ profile: null }),
}));

vi.mock("@/modules/notifications/hooks", () => ({
  useUnreadCount: () => ({ count: 0 }),
  useNotificationPreferences: () => ({ preferences: null }),
}));

vi.mock("@/modules/messaging", () => ({
  useTotalUnread: () => ({ count: 0 }),
}));

vi.mock("@/modules/footprints", () => ({
  useFootprintsUnreadCount: () => ({ count: 0 }),
}));

vi.mock("@/modules/post/components/PostComposerModal", () => ({
  PostComposerModal: () => null,
}));

const karteMocks = vi.hoisted(() => ({
  useMyKarteAccess: vi.fn(),
}));

vi.mock("@/modules/karte/hooks/useMyKarteAccess", () => ({
  useMyKarteAccess: karteMocks.useMyKarteAccess,
}));

const authState = vi.hoisted(() => ({ role: null as "guest" | "cast" | null, activeProfileId: null }));

vi.mock("@/stores/authStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/stores/authStore")>()),
  useAuthStore: (selector: (state: typeof authState) => unknown) => selector(authState),
}));

const { SideNav } = await import("./SideNav");
const { AccountProfilesProvider } = await import("@/modules/profile/context/AccountProfilesContext");
const { emptyProfileView } = await import("@/modules/profile/lib/mappers");

describe("SideNav", () => {
  it("offers the account's other profiles to switch to", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    const profiles = [{ ...emptyProfileView("p2"), username: "second_persona" }];

    const html = renderToStaticMarkup(
      <AccountProfilesProvider value={{ profiles, switchProfile: () => {}, refresh: async () => {}, append: async () => {} }}>
        <SideNav />
      </AccountProfilesProvider>
    );

    expect(html).toContain("プロフィールを切り替え");
    expect(html).toContain("@second_persona");
  });

  it("links to my karte when the viewer has karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).toContain("/karte/my");
    expect(html).toContain("カルテ");
    expect(html.indexOf("カルテ")).toBeLessThan(html.indexOf("設定"));
  });

  it("links to my reviews only for a guest viewer", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    authState.role = "guest";
    const asGuest = renderToStaticMarkup(<SideNav />);
    authState.role = "cast";
    const asCast = renderToStaticMarkup(<SideNav />);
    authState.role = null;

    expect(asGuest).toContain("/reviews/my");
    expect(asCast).not.toContain("/reviews/my");
  });

  it("hides the karte item when the viewer has no karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).not.toContain("/karte/my");
  });

  it("draws the entry of the current page with a heavier line than the others", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).toMatch(/<a[^>]*href="\/"[^>]*><svg[^>]*stroke-width="2.5"/);
    expect(html).toMatch(/<a[^>]*href="\/search"[^>]*><svg[^>]*stroke-width="2"/);
  });

  it("has no standalone oshi menu entry", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).not.toContain("/oshi");
  });
});
