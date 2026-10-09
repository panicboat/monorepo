// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { mutate as globalMutate, useSWRConfig, type ScopedMutator } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyProfileView } from "@/modules/profile/lib/mappers";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// The shell keeps a cache per acting profile, so its requests are revalidated through the mutator of that cache.
const shell: { mutate: ScopedMutator | null } = { mutate: null };

function revalidateInShell(key: string) {
  if (!shell.mutate) throw new Error("the shell has not rendered, so nothing can be revalidated in its cache");
  return shell.mutate(key);
}

const LIST_MS = 40;
const REQUEST_MS = 30;

vi.mock("next/navigation", () => ({
  usePathname: () => "/home",
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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
  const { useTotalUnread } = await import("@/modules/messaging/hooks/useTotalUnread");
  const { useFootprintsUnreadCount } = await import("@/modules/footprints/hooks/useFootprintsUnreadCount");
  const { useNotificationPreferences } = await import("@/modules/notifications/hooks/useNotificationPreferences");
  const { useMyKarteAccess } = await import("@/modules/karte/hooks/useMyKarteAccess");
  const { useProfile } = await import("@/modules/profile/hooks/useProfile");
  const { useSuggestedUsers } = await import("@/modules/discovery/hooks/useSuggestedUsers");
  const { useFollow } = await import("@/modules/social/hooks/useFollow");
  return {
    Drawer: () => {
      shell.mutate = useSWRConfig().mutate;
      useUnreadCount();
      useTotalUnread();
      useFootprintsUnreadCount();
      useNotificationPreferences();
      useMyKarteAccess();
      useProfile();
      useSuggestedUsers();
      useFollow("someone-else");
      return createElement("div", { "data-testid": "shell-mounted" });
    },
  };
});

type AccountId = "account-A" | "account-B";

interface RecordedCall {
  url: string;
  account: AccountId;
  profileId: string | null;
  status?: number;
}

const server = {
  cookieAccount: "account-A" as AccountId,
  profiles: {
    "account-A": [emptyProfileView("pA")],
    "account-B": [emptyProfileView("pB")],
  } as Record<AccountId, ReturnType<typeof emptyProfileView>[]>,
  owners: { pA: "account-A", pB: "account-B" } as Record<string, AccountId>,
  rejectedProfiles: new Set<string>(),
  calls: [] as RecordedCall[],
};

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
});
memory.set(
  "frontend-auth",
  JSON.stringify({ state: { role: "cast", accountId: "account-A", activeProfileId: "pA" }, version: 1 })
);

const { useAuthStore } = await import("@/stores/authStore");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const profileId = new Headers(init?.headers).get("x-profile-id");
  const account = server.cookieAccount;
  const call: RecordedCall = { url, account, profileId, status: undefined };
  server.calls.push(call);

  if (url === "/api/identity/me") {
    await sleep(REQUEST_MS);
    call.status = 200;
    return json(200, { account: { id: account, role: 2 } });
  }

  if (url === "/api/profile/mine") {
    await sleep(LIST_MS);
    call.status = 200;
    return json(200, { profiles: server.profiles[account] });
  }

  await sleep(REQUEST_MS);
  if (profileId && (server.rejectedProfiles.has(profileId) || server.owners[profileId] !== account)) {
    call.status = 403;
    return json(403, { error: "forbidden", code: "profile_not_permitted" });
  }

  call.status = 200;
  return json(200, { count: 0, profiles: [], statuses: {}, profile: { id: profileId ?? "resolved" } });
});

async function waitFor(
  condition: () => boolean,
  timeoutMs = 3000,
  details: () => unknown = () => ({
    state: useAuthStore.getState(),
    calls: server.calls.map(({ url, account, profileId, status }) => ({ url, account, profileId, status })),
  })
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await sleep(10);
  }
  throw new Error(`The recovery state did not settle before the timeout: ${JSON.stringify(details())}`);
}

async function clearSWRCache() {
  await globalMutate(() => true);
  await globalMutate(() => true, undefined, { revalidate: false });
}

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
      createElement(
        SWRProvider,
        null,
        createElement(
          AuthProvider,
          null,
          createElement(AppShell, null, createElement("div", null, "page"))
        )
      )
    );
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

beforeEach(async () => {
  server.cookieAccount = "account-A";
  server.profiles = {
    "account-A": [emptyProfileView("pA")],
    "account-B": [emptyProfileView("pB")],
  };
  server.owners = { pA: "account-A", pB: "account-B" };
  server.rejectedProfiles.clear();
  server.calls.length = 0;
  memory.clear();
  useAuthStore.getState().clearIdentity();
  useAuthStore.getState().setIdentity({ accountId: "account-A", role: "cast" });
  useAuthStore.getState().setActiveProfile("pA");
  useAuthStore.getState().setHydrated();
  await clearSWRCache();
});

afterEach(async () => {
  await clearSWRCache();
  useAuthStore.getState().clearIdentity();
});

describe("AppShell profile recovery", () => {
  it("switches to the cookie account and its profile after an acting-profile rejection", async () => {
    const app = await mountApp();
    try {
      await act(async () => {
        await waitFor(
          () => server.calls.some((call) => call.url === "/api/profile/mine" && call.status === 200)
        );
        await sleep(100);
      });
      expect(useAuthStore.getState()).toMatchObject({ accountId: "account-A", activeProfileId: "pA" });

      server.cookieAccount = "account-B";
      void revalidateInShell("/api/notifications/unread-count");
      await act(async () => {
        await sleep(500);
      });
      const countAfterRecovery = server.calls.length;
      await act(async () => {
        await sleep(200);
      });
      const countAfterObservation = server.calls.length;

      expect(countAfterRecovery).toBeLessThan(60);
      expect(countAfterObservation).toBe(countAfterRecovery);
      expect(useAuthStore.getState()).toMatchObject({ accountId: "account-B", activeProfileId: "pB" });
      expect(server.calls.some((call) => call.url === "/api/identity/me" && call.account === "account-B")).toBe(true);
    } finally {
      await app.unmount();
    }
  });

  it("keeps a denied sole profile inactive and renders the profile gate", async () => {
    const app = await mountApp();
    try {
      await act(async () => {
        await waitFor(
          () => server.calls.some((call) => call.url === "/api/profile/mine" && call.status === 200)
        );
        await sleep(100);
      });
      server.rejectedProfiles.add("pA");
      void revalidateInShell("/api/notifications/unread-count");
      await act(async () => {
        await sleep(500);
      });
      const countAfterRecovery = server.calls.length;
      await act(async () => {
        await sleep(200);
      });
      const countAfterObservation = server.calls.length;

      expect(countAfterRecovery).toBeLessThan(60);
      expect(countAfterObservation).toBe(countAfterRecovery);
      expect(useAuthStore.getState()).toMatchObject({
        activeProfileId: null,
        deniedProfileId: "pA",
      });
      expect(app.container.textContent).toContain("このプロフィールは利用できません");
    } finally {
      await app.unmount();
    }
  });
});
