import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/modules/profile/hooks", () => ({
  useProfile: () => ({ profile: null }),
}));

vi.mock("@/modules/social", () => ({
  useSocialCounts: () => ({ followingCount: 0, followersCount: 0 }),
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

vi.mock("@/modules/identity/hooks/useAuth", () => ({
  useAuth: () => ({ logout: vi.fn() }),
}));

const karteMocks = vi.hoisted(() => ({
  useMyKarteAccess: vi.fn(),
}));

vi.mock("@/modules/karte/hooks/useMyKarteAccess", () => ({
  useMyKarteAccess: karteMocks.useMyKarteAccess,
}));

const { Drawer } = await import("./Drawer");

describe("Drawer", () => {
  it("has no standalone oshi menu entry", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} />);

    expect(html).not.toContain("/oshi");
  });
});
