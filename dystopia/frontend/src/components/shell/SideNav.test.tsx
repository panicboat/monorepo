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

const authMocks = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: authMocks.useAuthStore,
  selectRole: (s: { role: string | null }) => s.role,
}));

const { SideNav } = await import("./SideNav");

describe("SideNav", () => {
  it("links to my karte when the viewer is a cast with karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });
    authMocks.useAuthStore.mockReturnValue("cast");

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).toContain("/karte/my");
    expect(html).toContain("カルテ");
  });

  it("hides the karte item when the viewer has no karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    authMocks.useAuthStore.mockReturnValue("cast");

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).not.toContain("/karte/my");
  });

  it("hides the karte item for a Guest viewer even with karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });
    authMocks.useAuthStore.mockReturnValue("guest");

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).not.toContain("/karte/my");
  });

  it("has no standalone oshi menu entry", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    authMocks.useAuthStore.mockReturnValue("cast");

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).not.toContain("/oshi");
  });
});
