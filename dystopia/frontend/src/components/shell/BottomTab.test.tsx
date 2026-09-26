import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@/modules/notifications/hooks", () => ({
  useUnreadCount: () => ({ count: 0 }),
}));

vi.mock("@/modules/messaging", () => ({
  useTotalUnread: () => ({ count: 0 }),
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

const { BottomTab } = await import("./BottomTab");

describe("BottomTab", () => {
  it("shows the karte tab for a Cast viewer and hides the review tab", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });
    authMocks.useAuthStore.mockReturnValue("cast");

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).toContain("/karte/my");
    expect(html).toContain("カルテ");
    expect(html).not.toContain("/reviews/my");
  });

  it("shows the review tab for a Guest viewer and hides the karte tab", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    authMocks.useAuthStore.mockReturnValue("guest");

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).toContain("/reviews/my");
    expect(html).toContain("レビュー");
    expect(html).not.toContain("/karte/my");
  });

  it("hides both the karte and review tabs without access or a resolved role", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    authMocks.useAuthStore.mockReturnValue(null);

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).not.toContain("/karte/my");
    expect(html).not.toContain("/reviews/my");
  });
});
