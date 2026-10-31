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

const authMocks = vi.hoisted(() => ({
  useAuthStore: vi.fn(),
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: authMocks.useAuthStore,
  selectRole: (s: { role: string | null }) => s.role,
}));

vi.mock("@/components/compose/ScheduleComposeSheet", () => ({
  ScheduleComposeSheet: ({ open }: { open: boolean }) => <div data-testid="schedule-sheet">{open ? "open" : "closed"}</div>,
}));

const { BottomTab } = await import("./BottomTab");

describe("BottomTab", () => {
  it("shows the karte tab for a Cast viewer and hides the review tab", () => {
    authMocks.useAuthStore.mockReturnValue("cast");

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).toContain("/karte/my");
    expect(html).toContain("カルテ");
    expect(html).not.toContain("/reviews/my");
  });

  it("replaces search with a schedule button for a Cast viewer", () => {
    authMocks.useAuthStore.mockReturnValue("cast");

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).not.toContain('href="/search"');
    expect(Array.from(html.matchAll(/<span>([^<]+)<\/span>/g), (m) => m[1])).toEqual(["ホーム", "予定", "通知", "メッセージ", "カルテ"]);
    expect(html).not.toContain("schedule-sheet");
  });

  it("opens the schedule sheet from the schedule button without changing the page", async () => {
    authMocks.useAuthStore.mockReturnValue("cast");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<BottomTab />);
    });

    await act(async () => {
      (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "予定") as HTMLButtonElement).click();
    });

    expect(container.querySelector('[data-testid="schedule-sheet"]')?.textContent).toBe("open");
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("keeps search and offers no schedule button for a Guest viewer", () => {
    authMocks.useAuthStore.mockReturnValue("guest");

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).toContain('href="/search"');
    expect(html).not.toContain("予定");
  });

  it("shows the review tab for a Guest viewer and hides the karte tab", () => {
    authMocks.useAuthStore.mockReturnValue("guest");

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).toContain("/reviews/my");
    expect(html).toContain("クチコミ");
    expect(html).not.toContain("/karte/my");
  });

  it("hides both the karte and review tabs before the role is known", () => {
    authMocks.useAuthStore.mockReturnValue(null);

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html).not.toContain("/karte/my");
    expect(html).not.toContain("/reviews/my");
  });

  it("draws every tab as a line icon and the tab of the current page with a heavier line", () => {
    authMocks.useAuthStore.mockReturnValue(null);

    const html = renderToStaticMarkup(<BottomTab />);

    expect(html.match(/<svg/g)).toHaveLength(4);
    expect(html).toMatch(/<a href="\/"[^>]*><svg[^>]*stroke-width="2.5"/);
    expect(html.match(/stroke-width="2"/g)).toHaveLength(3);
  });

  it("stands on the app surface under a rule with 11px labels", () => {
    authMocks.useAuthStore.mockReturnValue(null);

    const html = renderToStaticMarkup(<BottomTab />);
    const nav = /<nav class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];
    const home = /<a href="\/"[^>]*class="([^"]*)"/.exec(html)?.[1].split(/\s+/) ?? [];

    expect(nav).toEqual(expect.arrayContaining(["sticky", "bottom-0", "bg-bg", "border-t", "border-divider"]));
    expect(nav).not.toContain("pb-safe");
    expect(home).toEqual(expect.arrayContaining(["text-[0.6875rem]", "text-accent"]));
  });

  describe("tapping the home tab while already on the home page", () => {
    async function renderBottomTab() {
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
