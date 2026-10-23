// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  device: { state: "off" as string, busy: false, failed: false, enable: vi.fn(async () => {}), disable: vi.fn(async () => {}) },
  preferences: {
    pushEnabled: true,
    comment: true,
    like: true,
    reply: true,
    follow: true,
    mention: true,
    message: true,
    footprintUnreadBadge: true,
    footprintsRecordMyVisits: true,
  },
  update: vi.fn(async () => {}),
}));

vi.mock("@/modules/notifications/hooks/usePushDevice", () => ({ usePushDevice: () => mocks.device }));
vi.mock("@/modules/notifications/hooks/useNotificationPreferences", () => ({
  useNotificationPreferences: () => ({ preferences: mocks.preferences, loading: false, updating: false, error: null, update: mocks.update }),
}));

const { NotificationSettings } = await import("./NotificationSettings");

let container: HTMLElement;
let root: ReturnType<typeof createRoot>;

async function mount() {
  container = document.createElement("div");
  root = createRoot(container);
  await act(async () => root.render(createElement(NotificationSettings)));
}

function toggle(label: string) {
  return container.querySelector(`[role="switch"][aria-label="${label}"]`) as HTMLButtonElement;
}

beforeEach(() => {
  mocks.device = { state: "off", busy: false, failed: false, enable: vi.fn(async () => {}), disable: vi.fn(async () => {}) };
  mocks.preferences = { ...mocks.preferences, pushEnabled: true };
  mocks.update.mockReset();
});

afterEach(async () => {
  await act(async () => root.unmount());
});

describe("NotificationSettings", () => {
  it("lists the device switch, the profile switch and the six kinds", async () => {
    await mount();

    for (const label of ["この端末で受け取る", "端末に通知を送る", "いいね", "コメント", "リプライ", "メンション", "フォロー", "メッセージ"]) {
      expect(toggle(label)).not.toBeNull();
    }
    for (const removed of ["リポスト", "引用", "推し！", "ポスト"]) {
      expect(toggle(removed)).toBeNull();
    }
    expect(container.textContent).toContain("アプリ内の通知一覧には、設定に関係なくすべて表示されます。メッセージは通知一覧には載らず、「メッセージ」の未読件数でお知らせします");
  });

  it("explains why the device cannot receive notifications and locks its switch", async () => {
    const notes: Record<string, string> = {
      unsupported: "この端末では受け取れません",
      "needs-install": "ホーム画面に追加すると受け取れます",
      denied: "ブラウザの設定で通知を許可してください",
      unconfigured: "この環境では受け取れません",
    };
    for (const [state, note] of Object.entries(notes)) {
      mocks.device = { ...mocks.device, state };
      await mount();
      expect(container.textContent).toContain(note);
      expect(toggle("この端末で受け取る").disabled).toBe(true);
      await act(async () => root.unmount());
    }
    await mount();
  });

  it("turns the device on and off", async () => {
    await mount();
    await act(async () => toggle("この端末で受け取る").click());
    expect(mocks.device.enable).toHaveBeenCalled();
    await act(async () => root.unmount());

    mocks.device = { ...mocks.device, state: "on" };
    await mount();
    expect(toggle("この端末で受け取る").getAttribute("aria-checked")).toBe("true");
    await act(async () => toggle("この端末で受け取る").click());
    expect(mocks.device.disable).toHaveBeenCalled();
  });

  it("locks the kinds while the profile sends nothing to devices", async () => {
    mocks.preferences = { ...mocks.preferences, pushEnabled: false };

    await mount();

    expect(toggle("いいね").disabled).toBe(true);
    expect(toggle("端末に通知を送る").disabled).toBe(false);
  });

  it("shows a failed device change", async () => {
    mocks.device = { ...mocks.device, failed: true };

    await mount();

    expect(container.textContent).toContain("端末の設定を変更できませんでした");
  });
});
