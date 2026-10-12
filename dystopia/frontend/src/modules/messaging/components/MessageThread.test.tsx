// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import type { MessageView, SendRestrictionView, ThreadView } from "../types";
import { MessageThread } from "./MessageThread";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({ thread: null as ThreadView | null, restriction: "none" as SendRestrictionView, messages: [] as MessageView[], error: null as Error | null, send: vi.fn(), markRead: vi.fn(), retry: vi.fn() }));
vi.mock("@/modules/messaging", () => ({
  useMessages: () => ({ messages: state.messages, hasMore: false, loading: false, error: state.error, send: state.send, markRead: state.markRead, refresh: state.retry }),
  useThread: () => ({ thread: state.thread, sendRestriction: state.restriction, loading: false, error: null, refresh: state.retry }),
}));
let root: ReturnType<typeof createRoot> | undefined; let container: HTMLDivElement;
async function mount() { container = document.createElement("div"); root = createRoot(container); await act(async () => root!.render(<MessageThread threadId="t-1" />)); }
beforeEach(() => {
  root = undefined; useAuthStore.setState({ accountId: "owner", activeProfileId: "viewer-1" });
  state.thread = { id: "t-1", counterpart: { profileId: "cast-1", username: "yuna", displayName: "ゆな", avatarUrl: "", isPrivate: false, role: "cast" }, lastMessage: null, unreadCount: 0, lastMessageAt: "" };
  state.messages = [{ id: "m-1", threadId: "t-1", senderProfileId: "cast-1", content: "こんにちは", createdAt: "" }];
  state.restriction = "none"; state.error = null; state.send.mockReset().mockResolvedValue(undefined); state.markRead.mockReset().mockResolvedValue(undefined); state.retry.mockReset().mockResolvedValue(undefined);
});
afterEach(async () => { await act(async () => root?.unmount()); });
describe("MessageThread", () => {
  it("links the counterpart and shows their initial beside incoming messages", () => { const html = renderToStaticMarkup(<MessageThread threadId="t-1" />); expect(html).toContain('href="/u/yuna"'); expect(html).toContain("ゆな"); expect(html.match(/>ゆ</g)?.length).toBe(2); expect(html).toContain("<textarea"); });
  it("preserves the existing follow restriction", () => { state.restriction = "follow_required"; const html = renderToStaticMarkup(<MessageThread threadId="t-1" />); expect(html).not.toContain("<textarea"); expect(html).toContain("相手をフォローするとメッセージを送れます"); expect(html).toContain("プロフィールを見る"); });
  it("does not link a withdrawn counterpart", () => { state.thread = { ...state.thread!, counterpart: null }; state.restriction = "counterpart_unavailable"; const html = renderToStaticMarkup(<MessageThread threadId="t-1" />); expect(html).toContain("(退会)"); expect(html).not.toContain('href="/u/'); });
  it("marks the newest incoming message once and sends through the thread", async () => {
    await mount(); expect(state.markRead).toHaveBeenCalledExactlyOnceWith("m-1"); const input = container.querySelector("textarea")!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(input, "返信です"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(state.send).toHaveBeenCalledExactlyOnceWith("返信です"); expect(state.markRead).toHaveBeenCalledTimes(1); expect(input.value).toBe("");
  });
  it("shows message loading failures with retry", async () => { state.error = new Error("offline"); await mount(); expect(container.textContent).toContain("メッセージを取得できませんでした"); await act(async () => (container.querySelector("button") as HTMLButtonElement).click()); expect(state.retry).toHaveBeenCalled(); });
  it("delivers read failures to the active view and allows retry", async () => { state.markRead.mockRejectedValueOnce(new Error("offline")); await mount(); expect(container.querySelector("[role='alert']")?.textContent).toContain("既読を更新できませんでした"); await act(async () => (container.querySelector("[role='alert'] button") as HTMLButtonElement).click()); expect(state.markRead).toHaveBeenCalledTimes(2); });
});
