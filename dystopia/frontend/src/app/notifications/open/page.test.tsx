// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => {
  const accountProfiles = [{ id: "p1", disabled: false }, { id: "p2", disabled: false }];
  return {
    params: new URLSearchParams(),
    replace: vi.fn(),
    setActiveProfile: vi.fn(),
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
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ ...mocks.state, setActiveProfile: mocks.setActiveProfile }),
  selectActiveProfileId: (state: { activeProfileId: string | null }) => state.activeProfileId,
  selectDeniedProfileId: (state: { deniedProfileId: string | null }) => state.deniedProfileId,
}));

const { default: NotificationOpenPage } = await import("./page");

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;

async function open(query: string) {
  mocks.params = new URLSearchParams(query);
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(createElement(NotificationOpenPage)));
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.setActiveProfile.mockReset();
  mocks.state.activeProfileId = "p1";
  mocks.loaded = true;
  mocks.profiles = mocks.accountProfiles;
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("NotificationOpenPage", () => {
  it("switches to the receiving profile before opening anything", async () => {
    await open("profile=p2&to=%2Fposts%2F1");

    expect(mocks.setActiveProfile).toHaveBeenCalledWith("p2");
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("opens the page once the receiving profile is active", async () => {
    mocks.state.activeProfileId = "p2";

    await open("profile=p2&to=%2Fposts%2F1");

    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/posts/1");
  });

  it("opens the notification list for a destination outside the app", async () => {
    await open("profile=p1&to=https%3A%2F%2Fevil.example");

    expect(mocks.replace).toHaveBeenCalledWith("/notifications");
  });

  it("waits for the account's profile list before choosing between switching and opening", async () => {
    mocks.loaded = false;
    mocks.profiles = [];

    await open("profile=p2&to=%2Fposts%2F1");

    expect(mocks.setActiveProfile).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();

    mocks.loaded = true;
    mocks.profiles = mocks.accountProfiles;
    await act(async () => root.render(createElement(NotificationOpenPage)));

    expect(mocks.setActiveProfile).toHaveBeenCalledWith("p2");
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
