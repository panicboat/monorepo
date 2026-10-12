// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ authFetch: vi.fn(), push: vi.fn(), replace: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, replace: mocks.replace }) }));
vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));

const { useStartChat } = await import("./useStartChat");

const hook: { current: ReturnType<typeof useStartChat> | null } = { current: null };

function Probe() {
  hook.current = useStartChat();
  return null;
}

let root: Root;
let container: HTMLElement;

beforeEach(async () => {
  mocks.authFetch.mockReset().mockResolvedValue({ thread: { id: "thread-1" } });
  mocks.push.mockReset();
  mocks.replace.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(Probe)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("useStartChat", () => {
  it("adds the conversation to the history by default and returns its path", async () => {
    let path = "";
    await act(async () => {
      path = await hook.current!.start("target-1");
    });

    expect(path).toBe("/messages/thread-1");
    expect(mocks.push.mock.calls).toEqual([["/messages/thread-1"]]);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("puts the conversation in place of the current history entry when asked to replace", async () => {
    let path = "";
    await act(async () => {
      path = await hook.current!.start("target-1", { replace: true });
    });

    expect(path).toBe("/messages/thread-1");
    expect(mocks.replace.mock.calls).toEqual([["/messages/thread-1"]]);
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("sends the same request whichever way it navigates", async () => {
    await act(async () => {
      await hook.current!.start("target-1", { replace: true });
    });

    expect(mocks.authFetch.mock.calls).toEqual([
      ["/api/messaging/threads", { method: "POST", body: { recipientProfileId: "target-1" } }],
    ]);
  });

  it("stays on the page and reports the failure when no conversation comes back", async () => {
    mocks.authFetch.mockResolvedValue({ thread: null });
    let failure: unknown;

    await act(async () => {
      failure = await hook.current!.start("target-1", { replace: true }).catch((error: unknown) => error);
    });

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe("メッセージスレッドの作成に失敗しました");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
