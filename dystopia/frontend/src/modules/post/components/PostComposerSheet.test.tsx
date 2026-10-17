// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  mutate: vi.fn(),
  notifyPostCreated: vi.fn(),
  payload: { body: "こんにちは", isPrivate: false },
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("swr", () => ({ useSWRConfig: () => ({ mutate: mocks.mutate }) }));
vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/stores/postFeedStore", () => ({
  usePostFeedStore: (selector: (state: { notifyPostCreated: () => void }) => unknown) =>
    selector({ notifyPostCreated: mocks.notifyPostCreated }),
}));
vi.mock("./PostComposer", () => ({
  PostComposer: ({ onSubmit }: { onSubmit: (payload: unknown) => Promise<unknown> }) => (
    <button type="button" onClick={() => void onSubmit(mocks.payload)}>
      submit
    </button>
  ),
}));

const { PostComposerSheet } = await import("./PostComposerSheet");

let root: Root;
let container: HTMLElement;

const show = (open: boolean, onClose: () => void) =>
  act(async () => root.render(createElement(PostComposerSheet, { open, onClose })));

beforeEach(() => {
  mocks.authFetch.mockReset().mockResolvedValue({});
  mocks.mutate.mockReset();
  mocks.notifyPostCreated.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("PostComposerSheet", () => {
  it("shows the composer in a sheet titled for writing a post", async () => {
    await show(true, vi.fn());

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("投稿を作成");
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain("submit");
  });

  it("shows nothing while closed", async () => {
    await show(false, vi.fn());

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("posts what the composer submits, tells the feeds, and closes", async () => {
    const onClose = vi.fn();
    await show(true, onClose);

    await act(async () => {
      (Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "submit") as HTMLButtonElement).click();
    });

    expect(mocks.authFetch.mock.calls).toEqual([["/api/posts", { method: "POST", body: mocks.payload }]]);
    expect(mocks.notifyPostCreated).toHaveBeenCalledTimes(1);
    expect(mocks.mutate).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
