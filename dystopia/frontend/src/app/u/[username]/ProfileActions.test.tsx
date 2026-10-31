// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  role: "guest" as "guest" | "cast",
  isFollowing: false,
  isPending: false,
  approvalRequired: false,
  follow: vi.fn(),
  unfollow: vi.fn(),
  cancelRequest: vi.fn(),
  onUnfollow: undefined as (() => void) | undefined,
}));

vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { activeProfileId: string; role: string }) => unknown) =>
    selector({ activeProfileId: "viewer-1", role: mocks.role }),
  selectActiveProfileId: (state: { activeProfileId: string }) => state.activeProfileId,
  selectRole: (state: { role: string }) => state.role,
}));

vi.mock("@/modules/social", () => ({
  useFollow: () => ({
    isFollowing: mocks.isFollowing,
    isPending: mocks.isPending,
    approvalRequired: mocks.approvalRequired,
    follow: mocks.follow,
    unfollow: mocks.unfollow,
    cancelRequest: mocks.cancelRequest,
    loading: false,
  }),
  ProfileMoreMenu: ({ onUnfollow }: { onUnfollow?: () => void }) => {
    mocks.onUnfollow = onUnfollow;
    return <span>{onUnfollow ? "menu:unfollow,block" : "menu:block"}</span>;
  },
}));

vi.mock("@/modules/messaging", () => ({
  StartChatButton: ({ variant }: { variant?: string }) => <span>{`message:${variant}`}</span>,
}));

const { ProfileActions } = await import("./ProfileActions");

const render = (targetProfileId = "target-1") =>
  renderToStaticMarkup(<ProfileActions targetProfileId={targetProfileId} />);

const labels = (html: string) =>
  Array.from(html.matchAll(/<(?:span|button)[^>]*>([^<]+)</g)).map((m) => m[1]);

let root: Root | null = null;
let container: HTMLElement;

async function mount() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(createElement(ProfileActions, { targetProfileId: "target-1" }));
  });
}

const clickButton = (label: string) =>
  act(async () => {
    (Array.from(container.querySelectorAll("button")).find((b) => b.textContent === label) as HTMLButtonElement).click();
  });

beforeEach(() => {
  mocks.role = "guest";
  mocks.isFollowing = false;
  mocks.isPending = false;
  mocks.approvalRequired = false;
  mocks.follow.mockReset().mockResolvedValue(undefined);
  mocks.unfollow.mockReset().mockResolvedValue(undefined);
  mocks.cancelRequest.mockReset().mockResolvedValue(undefined);
  mocks.onUnfollow = undefined;
  vi.stubGlobal("confirm", () => true);
});

afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    container.remove();
    root = null;
  }
  vi.unstubAllGlobals();
});

describe("ProfileActions", () => {
  it("renders nothing on the viewer's own profile", () => {
    expect(render("viewer-1")).toBe("");
  });

  it("offers follow first and message second to a cast viewing an unfollowed public profile", () => {
    mocks.role = "cast";

    expect(labels(render())).toEqual(["menu:block", "message:secondary", "フォロー"]);
  });

  it("hides message from a guest viewing an unfollowed public profile", () => {
    expect(labels(render())).toEqual(["menu:block", "フォロー"]);
  });

  it("makes message the primary action and moves unfollow into the menu once following", () => {
    mocks.isFollowing = true;

    expect(labels(render())).toEqual(["menu:unfollow,block", "message:primary"]);
  });

  it("offers a follow request, not a plain follow, on an unfollowed profile that requires approval", () => {
    mocks.approvalRequired = true;

    expect(labels(render())).toEqual(["menu:block", "フォローを申請"]);
  });

  it("offers message to a cast on an unfollowed profile that requires approval", () => {
    mocks.role = "cast";
    mocks.approvalRequired = true;

    expect(labels(render())).toEqual(["menu:block", "message:secondary", "フォローを申請"]);
  });

  it("shows a pending request", () => {
    mocks.isPending = true;
    mocks.approvalRequired = true;

    expect(labels(render())).toEqual(["menu:block", "申請中"]);
  });

  it("follows when the follow button is pressed", async () => {
    await mount();
    await clickButton("フォロー");

    expect(mocks.follow).toHaveBeenCalledTimes(1);
  });

  it("cancels the pending request when the pending button is confirmed", async () => {
    mocks.isPending = true;
    await mount();
    await clickButton("申請中");

    expect(mocks.cancelRequest).toHaveBeenCalledTimes(1);
  });

  it("unfollows from the menu after confirmation", async () => {
    mocks.isFollowing = true;
    await mount();
    await act(async () => { await mocks.onUnfollow?.(); });

    expect(mocks.unfollow).toHaveBeenCalledTimes(1);
  });

  it("keeps following when unfollow is not confirmed", async () => {
    mocks.isFollowing = true;
    vi.stubGlobal("confirm", () => false);
    await mount();
    await act(async () => { await mocks.onUnfollow?.(); });

    expect(mocks.unfollow).not.toHaveBeenCalled();
  });
});
