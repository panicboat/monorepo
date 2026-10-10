// @vitest-environment happy-dom
// React 19's act() needs this flag because testing-library does not set it reliably.
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function flush() {
  return act(async () => {
    await Promise.resolve();
  });
}

function stubMobileViewport() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });
}

function dispatchPointer(
  target: EventTarget,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY: number
) {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, cancelable: true, pointerType: "touch", clientX, clientY })
  );
}

const profileMocks = vi.hoisted(() => ({
  useProfile: vi.fn(),
}));

vi.mock("@/modules/profile/hooks", () => ({
  useProfile: profileMocks.useProfile,
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
const { AccountProfilesProvider } = await import("@/modules/profile/context/AccountProfilesContext");
const { emptyProfileView } = await import("@/modules/profile/lib/mappers");

describe("Drawer", () => {
  it("takes its links and buttons out of reach while closed and gives them back when open", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    profileMocks.useProfile.mockReturnValue({ profile: null });
    const menu = (html: string) => html.match(/<aside[^>]*>/)?.[0] ?? "";

    const closed = menu(renderToStaticMarkup(<Drawer open={false} onClose={() => {}} onOpen={() => {}} />));
    const open = menu(renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />));

    expect(closed).toContain("inert");
    expect(closed).toContain('aria-hidden="true"');
    expect(open).not.toContain("inert");
  });

  it("offers the account's other profiles to switch to", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    profileMocks.useProfile.mockReturnValue({ profile: null });
    const profiles = [{ ...emptyProfileView("p2"), username: "second_persona" }];

    const html = renderToStaticMarkup(
      <AccountProfilesProvider value={{ profiles, switchProfile: () => {}, refresh: async () => {}, append: async () => {} }}>
        <Drawer open onClose={() => {}} onOpen={() => {}} />
      </AccountProfilesProvider>
    );

    expect(html).toContain("プロフィールを切り替え");
    expect(html).toContain("@second_persona");
  });

  it("has no standalone oshi menu entry", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    profileMocks.useProfile.mockReturnValue({ profile: null });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).not.toContain("/oshi");
  });

  it("lists the side nav entries in the same order without home", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });
    profileMocks.useProfile.mockReturnValue({ profile: null });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);
    const nav = html.match(/<nav[^>]*>(.*?)<\/nav>/)?.[1] ?? "";
    const hrefs = Array.from(nav.matchAll(/href="([^"]+)"/g), (match) => match[1]);

    expect(hrefs).toEqual([
      "/search",
      "/notifications",
      "/messages",
      "/footprints",
      "/bookmarks",
      "/ranking",
      "/karte/my",
      "/profile",
      "/settings",
    ]);
  });

  it("links to my karte when the viewer has karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });
    profileMocks.useProfile.mockReturnValue({ profile: null });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).toContain("/karte/my");
  });

  it("hides the karte item when the viewer has no karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    profileMocks.useProfile.mockReturnValue({ profile: null });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).not.toContain("/karte/my");
  });

  it("links the follow counts to the viewer's following and followers pages", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    profileMocks.useProfile.mockReturnValue({
      profile: { username: "alice", id: "prof-1", displayName: "Alice", avatarUrl: null },
    });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).toContain('href="/u/alice/following"');
    expect(html).toContain('href="/u/alice/followers"');
  });

  it("falls back the follow count links to /profile while the viewer's profile is still loading", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
    profileMocks.useProfile.mockReturnValue({ profile: null });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).not.toContain("/u/undefined");
    expect(html).toContain('href="/profile"');
  });

  describe("edge-to-anywhere swipe to open", () => {
    function renderClosedDrawer() {
      karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
      profileMocks.useProfile.mockReturnValue({ profile: null });
      stubMobileViewport();

      const container = document.createElement("div");
      document.body.appendChild(container);
      const root = createRoot(container);
      const onOpen = vi.fn();

      return { container, root, onOpen };
    }

    async function teardown(root: ReturnType<typeof createRoot>, container: HTMLDivElement) {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    }

    it("calls onOpen when dragging right from within the content area past the threshold", async () => {
      const { container, root, onOpen } = renderClosedDrawer();

      await act(async () => {
        root.render(<Drawer open={false} onClose={() => {}} onOpen={onOpen} />);
      });
      await flush();

      const aside = container.querySelector("aside") as HTMLElement;
      Object.defineProperty(aside, "offsetWidth", { configurable: true, value: 320 });

      await act(async () => {
        dispatchPointer(window, "pointerdown", 50, 300);
        dispatchPointer(window, "pointermove", 250, 300);
        dispatchPointer(window, "pointerup", 250, 300);
      });
      await flush();

      expect(onOpen).toHaveBeenCalledTimes(1);

      await teardown(root, container);
    });

    it("does not call onOpen when the drag starts inside a horizontally scrollable row", async () => {
      const { container, root, onOpen } = renderClosedDrawer();

      await act(async () => {
        root.render(<Drawer open={false} onClose={() => {}} onOpen={onOpen} />);
      });
      await flush();

      const aside = container.querySelector("aside") as HTMLElement;
      Object.defineProperty(aside, "offsetWidth", { configurable: true, value: 320 });

      const scrollRow = document.createElement("div");
      Object.defineProperty(scrollRow, "scrollWidth", { configurable: true, value: 800 });
      Object.defineProperty(scrollRow, "clientWidth", { configurable: true, value: 320 });
      scrollRow.style.overflowX = "auto";
      container.appendChild(scrollRow);

      await act(async () => {
        dispatchPointer(scrollRow, "pointerdown", 50, 300);
        dispatchPointer(window, "pointermove", 250, 300);
        dispatchPointer(window, "pointerup", 250, 300);
      });
      await flush();

      expect(onOpen).not.toHaveBeenCalled();

      await teardown(root, container);
    });

    it("does not attach the open gesture while already open", async () => {
      const { container, root, onOpen } = renderClosedDrawer();

      await act(async () => {
        root.render(<Drawer open onClose={() => {}} onOpen={onOpen} />);
      });
      await flush();

      const aside = container.querySelector("aside") as HTMLElement;
      Object.defineProperty(aside, "offsetWidth", { configurable: true, value: 320 });

      await act(async () => {
        dispatchPointer(window, "pointerdown", 50, 300);
        dispatchPointer(window, "pointermove", 250, 300);
        dispatchPointer(window, "pointerup", 250, 300);
      });
      await flush();

      expect(onOpen).not.toHaveBeenCalled();

      await teardown(root, container);
    });
  });
});
