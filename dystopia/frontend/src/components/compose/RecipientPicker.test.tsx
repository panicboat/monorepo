// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialProfileView } from "@/modules/social/types";
import { resolveRecipientSource } from "./resolveRecipientSource";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const profile = (username: string, role: "cast" | "guest"): SocialProfileView => ({
  profileId: username,
  username,
  displayName: username.toUpperCase(),
  avatarUrl: "",
  isPrivate: false,
  role,
});

const mocks = vi.hoisted(() => ({
  following: [] as SocialProfileView[],
  followers: [] as SocialProfileView[],
  found: [] as SocialProfileView[],
  searches: [] as [string, number][],
}));

const list = (profiles: SocialProfileView[]) => ({ profiles, hasMore: false, loading: false, error: undefined, loadMore: () => {}, refresh: () => {} });

vi.mock("@/modules/social/hooks", () => ({
  useFollowList: () => list(mocks.following),
  useFollowerList: () => list(mocks.followers),
}));
vi.mock("@/modules/discovery/hooks/useSearchUsers", () => ({
  useSearchUsers: (query: string, role: number) => {
    mocks.searches.push([query, role]);
    return list(query ? mocks.found : []);
  },
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string }) => unknown) => selector({ activeProfileId: "me" }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
}));

const { RecipientPicker } = await import("./RecipientPicker");

let container: HTMLDivElement;

async function mount(kind: "message" | "karte" | "review", viewerRole: "cast" | "guest", onPick = vi.fn()) {
  container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(RecipientPicker, { source: resolveRecipientSource(kind, viewerRole), onPick }));
  });
  return async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  };
}

async function type(value: string) {
  const input = container.querySelector("input") as HTMLInputElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const listed = () => Array.from(container.querySelectorAll("li"), (li) => li.textContent?.match(/@(\w+)/)?.[1]);

beforeEach(() => {
  mocks.following = [profile("yuna", "cast"), profile("taro", "guest"), profile("me", "cast")];
  mocks.followers = [profile("jiro", "guest"), profile("mio", "cast")];
  mocks.found = [profile("saburo", "guest"), profile("rin", "cast")];
  mocks.searches.length = 0;
});

describe("RecipientPicker", () => {
  it("starts a message from the profiles the viewer follows, without the viewer", async () => {
    const unmount = await mount("message", "cast");

    expect(listed()).toEqual(["yuna", "taro"]);
    await unmount();
  });

  it("starts a karte entry from the guests among the followers", async () => {
    const unmount = await mount("karte", "cast");

    expect(listed()).toEqual(["jiro"]);
    await unmount();
  });

  it("starts a review from the casts the viewer follows", async () => {
    const unmount = await mount("review", "guest");

    expect(listed()).toEqual(["yuna"]);
    await unmount();
  });

  it("searches every guest for a karte entry once a name is typed", async () => {
    const unmount = await mount("karte", "cast");

    await type("sab");

    expect(mocks.searches.at(-1)).toEqual(["sab", 1]);
    expect(listed()).toEqual(["saburo"]);
    await unmount();
  });

  it("keeps a guest's message search among the profiles they follow", async () => {
    const unmount = await mount("message", "guest");

    await type("yu");

    expect(mocks.searches.every(([query]) => query === "")).toBe(true);
    expect(listed()).toEqual(["yuna"]);
    await unmount();
  });

  it("reports the profile that is chosen", async () => {
    const onPick = vi.fn();
    const unmount = await mount("message", "cast", onPick);

    await act(async () => {
      (container.querySelector("li button") as HTMLButtonElement).click();
    });

    expect(onPick.mock.calls).toEqual([[mocks.following[0]]]);
    await unmount();
  });

  it("says so when nobody matches", async () => {
    mocks.found = [];
    const unmount = await mount("review", "guest");

    await type("zzz");

    expect(container.textContent).toContain("該当する相手がいません");
    await unmount();
  });
});
