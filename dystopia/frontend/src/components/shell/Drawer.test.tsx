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

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).not.toContain("/oshi");
  });

  it("links to my karte when the viewer has karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: true });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).toContain("/karte/my");
  });

  it("hides the karte item when the viewer has no karte access", () => {
    karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });

    const html = renderToStaticMarkup(<Drawer open onClose={() => {}} onOpen={() => {}} />);

    expect(html).not.toContain("/karte/my");
  });

  describe("edge-to-anywhere swipe to open", () => {
    function renderClosedDrawer() {
      karteMocks.useMyKarteAccess.mockReturnValue({ hasAccess: false });
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
