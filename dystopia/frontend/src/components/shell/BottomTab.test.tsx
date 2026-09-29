// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import type { MouseEvent, ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function flush() {
  return act(async () => {
    await Promise.resolve();
  });
}

const navigationMocks = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/"),
}));

vi.mock("next/navigation", () => ({
  usePathname: navigationMocks.usePathname,
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    onClick,
    children,
    ...rest
  }: {
    href: string;
    onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
    children?: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} onClick={onClick} {...rest}>
      {children}
    </a>
  ),
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

  it("hides the karte tab for a Guest viewer even when karte access is on", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });
    authMocks.useAuthStore.mockReturnValue("guest");

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).not.toContain("/karte/my");
    expect(html).toContain("/reviews/my");
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

  describe("tapping the home tab while already on the home page", () => {
    async function renderBottomTab() {
      karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
      authMocks.useAuthStore.mockReturnValue(null);

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);

      await act(async () => {
        root.render(<BottomTab />);
      });
      await flush();

      return { container, root };
    }

    async function teardown(root: ReturnType<typeof createRoot>, container: HTMLDivElement) {
      await act(async () => {
        root.unmount();
      });
      container.remove();
      navigationMocks.usePathname.mockReturnValue("/");
    }

    it("scrolls to the top instead of navigating when the home path is already active", async () => {
      navigationMocks.usePathname.mockReturnValue("/");
      const scrollToSpy = vi.fn();
      window.scrollTo = scrollToSpy;
      const { container, root } = await renderBottomTab();

      const homeLink = container.querySelector('a[href="/"]') as HTMLAnchorElement;
      let notPrevented = true;
      await act(async () => {
        notPrevented = homeLink.dispatchEvent(
          new MouseEvent("click", { bubbles: true, cancelable: true })
        );
      });

      expect(notPrevented).toBe(false);
      expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });

      await teardown(root, container);
    });

    it("does not scroll when the home tab is tapped from another page", async () => {
      navigationMocks.usePathname.mockReturnValue("/search");
      const scrollToSpy = vi.fn();
      window.scrollTo = scrollToSpy;
      const { container, root } = await renderBottomTab();

      const homeLink = container.querySelector('a[href="/"]') as HTMLAnchorElement;
      await act(async () => {
        homeLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });

      expect(scrollToSpy).not.toHaveBeenCalled();

      await teardown(root, container);
    });
  });
});
