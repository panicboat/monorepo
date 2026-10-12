// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/stores/authStore";
import { MessageDraft } from "./MessageDraft";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
const sent = vi.fn(); const fetchMock = vi.fn<typeof fetch>();
async function mount() { container = document.createElement("div"); root = createRoot(container); await act(async () => root.render(createElement(MessageDraft, { recipientProfileId: "guest-1", onSent: sent }))); }
async function type() { const field = container.querySelector("textarea") as HTMLTextAreaElement; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "予約について相談したいです"); field.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit() { await act(async () => (container.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
beforeEach(() => { useAuthStore.setState({ accountId: "owner", activeProfileId: "writer", role: "cast" }); fetchMock.mockReset().mockImplementation(async () => new Response(JSON.stringify({ threadId: "stored-thread", message: { id: "message" } }))); vi.stubGlobal("fetch", fetchMock); sent.mockReset(); });
afterEach(async () => { await act(async () => root?.unmount()); vi.unstubAllGlobals(); });
describe("MessageDraft", () => {
  it("creates no empty thread and sends the first message through the recipient endpoint", async () => {
    await mount(); expect(fetchMock).not.toHaveBeenCalled(); await type(); await submit();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/messaging/messages");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ recipientProfileId: "guest-1", content: "予約について相談したいです" }); expect(sent).toHaveBeenCalledWith("stored-thread");
  });
  it("keeps the draft and exposes the existing send restriction", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ error: "相手をフォローするとメッセージを送れます", code: "follow_required" }), { status: 422 }));
    await mount(); await type(); await submit(); expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("予約について相談したいです"); expect(container.textContent).toContain("相手をフォローするとメッセージを送れます"); expect(sent).not.toHaveBeenCalled();
  });
  it("does not open an old conversation after switching profiles", async () => {
    let finish!: (value: Response) => void; fetchMock.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    await mount(); await type(); await submit(); await act(async () => useAuthStore.getState().setActiveProfile("another"));
    await act(async () => finish(new Response(JSON.stringify({ threadId: "old-thread", message: { id: "message" } })))); expect(sent).not.toHaveBeenCalled();
  });
});
