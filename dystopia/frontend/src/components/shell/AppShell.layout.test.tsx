// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = { pathname: "/" };

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/modules/identity/hooks/useAuth", () => ({ useAuth: () => ({ signOut: vi.fn() }) }));
vi.mock("@/components/shell/TopBar", () => ({ TopBar: () => null }));
vi.mock("@/components/shell/BottomTab", () => ({ BottomTab: () => createElement("nav", { "data-testid": "bottom-tab" }) }));
vi.mock("@/components/shell/ComposerFAB", () => ({ ComposerFAB: () => createElement("button", { "data-testid": "composer-fab" }) }));
vi.mock("@/components/shell/SideNav", () => ({ SideNav: () => null }));
vi.mock("@/components/shell/SuggestedUsersPane", () => ({ SuggestedUsersPane: () => null }));
vi.mock("@/components/shell/Drawer", () => ({ Drawer: () => null }));
vi.mock("@/modules/onboarding/components/FeatureTourModal", () => ({ FeatureTourModal: () => null }));
vi.mock("@/modules/landing/components/LandingPage", () => ({ LandingPage: () => null }));
vi.mock("@/modules/profile/hooks", () => ({
  useProfileSession: () => ({
    session: { kind: "active", profileId: "p1" },
    profiles: [emptyProfileView("p1")],
    hasListError: false,
    retry: () => {},
    refresh: async () => {},
    append: async () => {},
  }),
}));

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");
const { AppShell } = await import("./AppShell");

const mounted: (() => Promise<void>)[] = [];

async function mountAt(pathname: string) {
  navigation.pathname = pathname;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
  await act(async () => {
    root.render(createElement(AppShell, null, createElement("div", { "data-testid": "page" })));
  });
  const page = container.querySelector('[data-testid="page"]');
  if (!page) throw new Error(`the page did not render: ${container.innerHTML}`);
  const main = page.parentElement as HTMLElement;
  const frame = main.parentElement?.parentElement as HTMLElement;
  return { container, main, frame };
}

beforeEach(() => {
  memory.clear();
  useAuthStore.getState().clearIdentity();
  useAuthStore.getState().setIdentity({ accountId: "account-1", role: "guest" });
  useAuthStore.getState().setActiveProfile("p1");
  useAuthStore.getState().setHydrated();
});

afterEach(async () => {
  while (mounted.length > 0) await mounted.pop()?.();
  useAuthStore.getState().clearIdentity();
});

describe("AppShell layout", () => {
  it("fits a message thread between its bars: fixed to the viewport, no room reserved below, no post button over the composer", async () => {
    const { container, main, frame } = await mountAt("/messages/thread-1");

    expect(frame.className).toContain("h-dvh");
    expect(frame.className).toContain("overflow-hidden");
    expect(frame.className).not.toContain("min-h-dvh");
    expect(main.className).toContain("min-h-0");
    expect(main.className).not.toContain("pb-24");
    expect(container.querySelector('[data-testid="composer-fab"]')).toBeNull();
    expect(container.querySelector('[data-testid="bottom-tab"]')).not.toBeNull();
  });

  it("lets other pages grow with the document, clear of the bottom bar, with the post button", async () => {
    const { container, main, frame } = await mountAt("/messages");

    expect(frame.className).toContain("min-h-dvh");
    expect(frame.className).not.toContain("overflow-hidden");
    expect(main.className).toContain("pb-24");
    expect(container.querySelector('[data-testid="composer-fab"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="bottom-tab"]')).not.toBeNull();
  });
});
