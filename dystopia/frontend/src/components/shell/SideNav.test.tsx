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

const { SideNav } = await import("./SideNav");

describe("SideNav", () => {
  it("links to my karte when the viewer has karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).toContain("/karte/my");
    expect(html).toContain("カルテ");
  });

  it("hides the karte item when the viewer has no karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const html = renderToStaticMarkup(<SideNav />);

    expect(html).not.toContain("/karte/my");
  });
});
