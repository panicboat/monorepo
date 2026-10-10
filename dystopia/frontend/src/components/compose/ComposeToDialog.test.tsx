// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SocialProfileView } from "@/modules/social/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const target: SocialProfileView = { profileId: "guest-1", username: "taro", displayName: "たろう", avatarUrl: "", isPrivate: false, role: "guest" };

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  toast: vi.fn(),
  created: null as null | (() => void),
}));

vi.mock("./RecipientPicker", () => ({
  RecipientPicker: ({ onPick }: { onPick: (profile: SocialProfileView) => void }) => (
    <button type="button" onClick={() => onPick(target)}>
      pick
    </button>
  ),
}));
vi.mock("@/modules/messaging/hooks/useStartChat", () => ({ useStartChat: () => ({ start: mocks.start, loading: false }) }));
vi.mock("@/modules/karte/components/KarteComposer", () => ({
  KarteComposer: ({ targetProfileId, onCreated }: { targetProfileId: string; onCreated: () => void }) => {
    mocks.created = onCreated;
    return <div>karte-composer:{targetProfileId}</div>;
  },
}));
vi.mock("@/modules/review/components/ReviewComposer", () => ({
  ReviewComposer: ({ targetProfileId }: { targetProfileId: string }) => <div>review-composer:{targetProfileId}</div>,
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: (selector: (state: { role: string }) => unknown) => selector({ role: "cast" }),
  selectRole: (state: { role: string }) => state.role,
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) => selector({ show: mocks.toast }),
}));

const { ComposeToDialog } = await import("./ComposeToDialog");

async function mount(kind: "message" | "karte" | "review") {
  const onClose = vi.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(ComposeToDialog, { kind, onClose }));
  });
  return {
    onClose,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

const button = (label: string) =>
  Array.from(document.querySelectorAll("button")).find((candidate) => candidate.textContent === label || candidate.getAttribute("aria-label") === label) as HTMLButtonElement;

async function pick() {
  await act(async () => {
    button("pick").click();
  });
}

beforeEach(() => {
  mocks.start.mockReset().mockResolvedValue(undefined);
  mocks.toast.mockReset();
  mocks.created = null;
});

describe("ComposeToDialog", () => {
  it("opens the conversation with the chosen profile and closes", async () => {
    const view = await mount("message");
    expect(document.body.textContent).toContain("メッセージの相手を選ぶ");

    await pick();

    expect(mocks.start.mock.calls).toEqual([["guest-1"]]);
    expect(view.onClose).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it("shows why the conversation could not be opened and stays on the list", async () => {
    mocks.start.mockRejectedValue(new Error("相手をフォローするとメッセージを送れます"));
    const view = await mount("message");

    await pick();

    expect(document.querySelector('[role="alert"]')?.textContent).toBe("相手をフォローするとメッセージを送れます");
    expect(view.onClose).not.toHaveBeenCalled();
    expect(button("pick")).toBeDefined();
    await view.unmount();
  });

  it("moves on to the karte form for the chosen guest, and back to the list", async () => {
    const view = await mount("karte");

    await pick();
    expect(document.body.textContent).toContain("カルテを書く");
    expect(document.body.textContent).toContain("たろう");
    expect(document.body.textContent).toContain("karte-composer:guest-1");

    await act(async () => {
      button("宛先を選び直す").click();
    });
    expect(document.body.textContent).toContain("カルテを書くゲストを選ぶ");
    await view.unmount();
  });

  it("confirms a saved karte entry and closes", async () => {
    const view = await mount("karte");
    await pick();

    await act(async () => {
      mocks.created?.();
    });

    expect(mocks.toast.mock.calls).toEqual([["カルテを保存しました"]]);
    expect(view.onClose).toHaveBeenCalledTimes(1);
    await view.unmount();
  });

  it("moves on to the review form for the chosen cast", async () => {
    const view = await mount("review");

    await pick();

    expect(document.body.textContent).toContain("レビューを書く");
    expect(document.body.textContent).toContain("review-composer:guest-1");
    await view.unmount();
  });
});
