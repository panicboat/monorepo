// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { SWRConfig } from "swr";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { PostComposerModal } from "./PostComposerModal";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const notify = vi.hoisted(() => vi.fn());
vi.mock("@/stores/postFeedStore", () => ({ usePostFeedStore: (selector: (state: { notifyPostCreated: () => void }) => unknown) => selector({ notifyPostCreated: notify }) }));
let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
const close = vi.fn(); const fetchMock = vi.fn<typeof fetch>();
async function render(open: boolean) { await act(async () => root.render(createElement(SWRConfig, { value: { provider: () => new Map() } }, createElement(PostComposerModal, { open, onClose: close })))); }
async function type() { const field = document.querySelector("textarea") as HTMLTextAreaElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "予約のお知らせ #渋谷"); field.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit() { await act(async () => (document.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container); useAuthStore.setState({ accountId: "owner", activeProfileId: "writer", role: "cast" }); fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ post: { id: "post" } }))); vi.stubGlobal("fetch", fetchMock); close.mockReset(); notify.mockReset(); vi.spyOn(window.history, "back").mockImplementation(() => {}); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("PostComposerModal", () => {
  it("dismisses with browser Back and sends the existing post payload", async () => {
    await render(true); await type();
    await act(async () => (document.querySelector('[role="switch"]') as HTMLButtonElement).click());
    await submit();
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ content: "予約のお知らせ #渋谷", visibility: "private", media: [], hashtags: ["渋谷"] }); expect(notify).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1);
    close.mockClear(); window.history.replaceState(null, "", window.location.href);
    await act(async () => window.dispatchEvent(new PopStateEvent("popstate"))); expect(close).toHaveBeenCalledTimes(1);
  });
  it("does not close a reopened form when an earlier submission completes", async () => {
    let finish!: (value: Response) => void; fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await render(true); await type(); await submit(); await render(false); await render(true);
    await act(async () => finish(new Response(JSON.stringify({ post: { id: "saved" } })))); expect(close).not.toHaveBeenCalled();
  });
  it("keeps the content after a failed submission", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: "投稿できませんでした" }), { status: 500 }));
    await render(true); await type(); await submit(); expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("予約のお知らせ #渋谷"); expect(document.body.textContent).toContain("投稿できませんでした"); expect(close).not.toHaveBeenCalled();
  });
});
