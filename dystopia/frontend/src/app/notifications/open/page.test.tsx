// @vitest-environment happy-dom
import { StrictMode, act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => {
  const accountProfiles = [{ id: "p1", disabled: false }, { id: "p2", disabled: false }];
  return {
    params: new URLSearchParams(),
    replace: vi.fn(),
    setActiveProfile: vi.fn(),
    takeNotificationHandoff: vi.fn<(id: string | null) => Promise<{ profile: string | null; to: string | null } | null>>(),
    state: { activeProfileId: "p1" as string | null, deniedProfileId: null as string | null },
    accountProfiles,
    profiles: accountProfiles,
    loaded: true,
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.params,
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/modules/profile/context/AccountProfilesContext", () => ({
  useAccountProfiles: () => ({ profiles: mocks.profiles, loaded: mocks.loaded }),
}));
vi.mock("@/modules/notifications/lib/handoff", () => ({
  takeNotificationHandoff: mocks.takeNotificationHandoff,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ ...mocks.state, setActiveProfile: mocks.setActiveProfile }),
  selectActiveProfileId: (state: { activeProfileId: string | null }) => state.activeProfileId,
  selectDeniedProfileId: (state: { deniedProfileId: string | null }) => state.deniedProfileId,
}));

const { default: NotificationOpenPage } = await import("./page");

let root: ReturnType<typeof createRoot>;

async function open(query: string, { strict = false } = {}) {
  mocks.params = new URLSearchParams(query);
  root = createRoot(document.createElement("div"));
  const page = createElement(NotificationOpenPage);
  await act(async () => root.render(strict ? createElement(StrictMode, null, page) : page));
}

async function remountAs(profileId: string, query: string) {
  await act(async () => root.unmount());
  mocks.state.activeProfileId = profileId;
  await open(query);
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.setActiveProfile.mockReset();
  mocks.takeNotificationHandoff.mockReset().mockResolvedValue(null);
  mocks.state.activeProfileId = "p1";
  mocks.loaded = true;
  mocks.profiles = mocks.accountProfiles;
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("NotificationOpenPage", () => {
  it("never switches for a link the service worker did not record", async () => {
    await open("profile=p2&to=%2Fu%2Fattacker");

    expect(mocks.takeNotificationHandoff).toHaveBeenCalledWith(null);
    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/notifications");
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("ignores the profile and page in the link and acts only on the record", async () => {
    mocks.takeNotificationHandoff.mockResolvedValueOnce({ profile: "p1", to: "/posts/1" });

    await open("id=tap-2&profile=p2&to=%2Fu%2Fattacker");

    expect(mocks.takeNotificationHandoff).toHaveBeenCalledWith("tap-2");
    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/posts/1");
  });

  it("switches to the receiving profile before opening anything, then opens the page under it", async () => {
    mocks.takeNotificationHandoff.mockResolvedValueOnce({ profile: "p2", to: "/posts/1" });

    await open("id=tap-3");

    expect(mocks.setActiveProfile).toHaveBeenCalledWith("p2");
    expect(mocks.replace).not.toHaveBeenCalled();

    await remountAs("p2", "id=tap-3");

    expect(mocks.setActiveProfile).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith("/posts/1");
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("opens the page directly when the receiving profile is already active", async () => {
    mocks.state.activeProfileId = "p2";
    mocks.takeNotificationHandoff.mockResolvedValueOnce({ profile: "p2", to: "/posts/1" });

    await open("id=tap-4");

    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/posts/1");
  });

  it("opens the notification list as the active profile when the account cannot act as the receiving one", async () => {
    mocks.takeNotificationHandoff.mockResolvedValueOnce({ profile: "disabled-profile", to: "/u/rin" });

    await open("id=tap-6");

    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/notifications");
    expect(mocks.replace).toHaveBeenCalledTimes(1);
  });

  it("opens the notification list for a recorded destination outside the app", async () => {
    mocks.takeNotificationHandoff.mockResolvedValueOnce({ profile: "p1", to: "https://evil.example" });

    await open("id=tap-5");

    expect(mocks.replace).toHaveBeenCalledWith("/notifications");
  });

  it("reads the record once even when its effect runs twice", async () => {
    mocks.takeNotificationHandoff.mockResolvedValueOnce({ profile: "p2", to: "/posts/1" });

    await open("id=tap-6", { strict: true });

    expect(mocks.takeNotificationHandoff).toHaveBeenCalledTimes(1);
    expect(mocks.setActiveProfile).toHaveBeenCalledWith("p2");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("waits for the account's profile list before reading the record", async () => {
    mocks.loaded = false;
    mocks.profiles = [];
    mocks.takeNotificationHandoff.mockResolvedValueOnce({ profile: "p2", to: "/posts/1" });

    await open("id=tap-7");

    expect(mocks.takeNotificationHandoff).not.toHaveBeenCalled();
    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.loaded = true;
    mocks.profiles = mocks.accountProfiles;
    await act(async () => root.render(createElement(NotificationOpenPage)));

    expect(mocks.setActiveProfile).toHaveBeenCalledWith("p2");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
