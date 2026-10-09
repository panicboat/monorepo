// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { mutate as globalMutate } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const REQUEST_MS = 30;
const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/messages",
  useRouter: () => ({ replace: vi.fn(), push }),
}));
vi.mock("@/components/shell/TopBar", () => ({ TopBar: () => null }));
vi.mock("@/components/shell/BottomTab", () => ({ BottomTab: () => null }));
vi.mock("@/components/shell/ComposerFAB", () => ({ ComposerFAB: () => null }));
vi.mock("@/components/shell/SideNav", () => ({ SideNav: () => null }));
vi.mock("@/components/shell/SuggestedUsersPane", () => ({ SuggestedUsersPane: () => null }));
vi.mock("@/modules/onboarding/components/FeatureTourModal", () => ({ FeatureTourModal: () => null }));
vi.mock("@/modules/landing/components/LandingPage", () => ({ LandingPage: () => null }));
vi.mock("@/components/shell/Drawer", async () => {
  const { useUnreadCount } = await import("@/modules/notifications/hooks/useUnreadCount");
  const { ProfileSwitcher } = await import("@/modules/profile/components/ProfileSwitcher");
  return {
    Drawer: () => {
      const { count } = useUnreadCount();
      return createElement(
        "div",
        { "data-testid": "shell-mounted" },
        createElement("span", { "data-testid": "unread" }, String(count)),
        createElement(ProfileSwitcher)
      );
    },
  };
});

const unreadByProfile: Record<string, number> = { pA: 1, pB: 2 };
const calls: { url: string; profileId: string | null }[] = [];

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});

const { useAuthStore } = await import("@/stores/authStore");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const profile = (id: string, username: string) => ({ ...emptyProfileView(id), username, displayName: username });

vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const profileId = new Headers(init?.headers).get("x-profile-id");
  calls.push({ url, profileId });
  await sleep(REQUEST_MS);
  if (url === "/api/identity/me") return json({ account: { id: "account-A", role: 2 } });
  if (url === "/api/profile/mine") {
    return json({ profiles: [profile("pA", "persona_a"), profile("pB", "persona_b"), { ...profile("pC", "persona_c"), disabled: true }] });
  }
  return json({ count: profileId ? unreadByProfile[profileId] : 0 });
});

async function mountApp() {
  const [{ AppShell }, { AuthProvider }, { SWRProvider }] = await Promise.all([
    import("./AppShell"),
    import("@/modules/identity/hooks/useAuth"),
    import("@/components/providers/SWRProvider"),
  ]);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      createElement(SWRProvider, null, createElement(AuthProvider, null, createElement(AppShell, null, createElement("div", null, "page"))))
    );
  });
  return {
    container,
    unread: () => container.querySelector('[data-testid="unread"]')?.textContent ?? null,
    click: async (text: string) => {
      const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent?.includes(text));
      if (!button) throw new Error(`no button containing ${text}`);
      await act(async () => {
        button.click();
      });
    },
    settle: async () => {
      await act(async () => {
        await sleep(REQUEST_MS * 4);
      });
    },
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(async () => {
  calls.length = 0;
  push.mockClear();
  memory.clear();
  useAuthStore.getState().clearIdentity();
  useAuthStore.getState().setIdentity({ accountId: "account-A", role: "cast" });
  useAuthStore.getState().setHydrated();
  await globalMutate(() => true);
  await globalMutate(() => true, undefined, { revalidate: false });
});

afterEach(() => {
  useAuthStore.getState().clearIdentity();
});

describe("AppShell with several enabled profiles", () => {
  it("asks which profile to use and sends no request as a profile before the choice", async () => {
    const app = await mountApp();
    await app.settle();

    expect(app.container.textContent).toContain("プロフィールを選択");
    expect(app.container.textContent).toContain("@persona_a");
    expect(app.container.textContent).toContain("@persona_b");
    expect(app.container.textContent).not.toContain("@persona_c");
    expect(app.container.querySelector('[data-testid="shell-mounted"]')).toBeNull();
    expect(calls.filter((call) => call.profileId !== null)).toEqual([]);
    await app.unmount();
  });

  it("opens the shell as the chosen profile without leaving the current page", async () => {
    const app = await mountApp();
    await app.settle();

    await app.click("@persona_a");
    await app.settle();

    expect(useAuthStore.getState().activeProfileId).toBe("pA");
    expect(app.unread()).toBe("1");
    expect(push).not.toHaveBeenCalled();
    await app.unmount();
  });

  it("shows nothing of the previous profile after a switch, loads as the next one and goes to the top", async () => {
    const app = await mountApp();
    await app.settle();
    await app.click("@persona_a");
    await app.settle();
    expect(app.unread()).toBe("1");
    calls.length = 0;

    await app.click("@persona_b");

    expect(useAuthStore.getState().activeProfileId).toBe("pB");
    expect(app.unread()).toBe("0");
    expect(push.mock.calls).toEqual([["/"]]);

    await app.settle();

    expect(app.unread()).toBe("2");
    expect(calls.filter((call) => call.url === "/api/notifications/unread-count").map((call) => call.profileId)).toEqual(["pB"]);
    expect(app.container.textContent).toContain("@persona_a");
    expect(app.container.textContent).not.toContain("@persona_b");
    await app.unmount();
  });

  it("does not offer a profile the server denied until the list is retried", async () => {
    useAuthStore.getState().setActiveProfile("pA");
    const app = await mountApp();
    await app.settle();

    await act(async () => {
      useAuthStore.getState().denyActiveProfile("pA");
    });
    await app.settle();

    expect(app.container.textContent).toContain("プロフィールを選択");
    expect(app.container.textContent).toContain("@persona_b");
    expect(app.container.textContent).not.toContain("@persona_a");
    await app.unmount();
  });

  it("keeps the stored profile across a reload", async () => {
    useAuthStore.getState().setActiveProfile("pB");
    const app = await mountApp();
    await app.settle();

    expect(app.container.textContent).not.toContain("プロフィールを選択");
    expect(app.unread()).toBe("2");
    await app.unmount();
  });
});
