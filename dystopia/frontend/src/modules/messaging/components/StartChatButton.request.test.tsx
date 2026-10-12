// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { useAuthStore } from "@/stores/authStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
vi.mock("@/modules/social/hooks", () => ({ useFollow: () => ({ isFollowing: false }) }));
const { StartChatButton } = await import("./StartChatButton");
let root: ReturnType<typeof createRoot>; let container: HTMLDivElement;
afterEach(async () => { await act(async () => root?.unmount()); container?.remove(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("StartChatButton request", () => {
  it("keeps the known recipient, sends no empty thread and navigates after the first saved message", async () => {
    useAuthStore.setState({ accountId: "owner", activeProfileId: "viewer-1", role: "cast" });
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ threadId: "thread-1", message: { id: "message" } }))); vi.stubGlobal("fetch", fetchMock); vi.spyOn(window.history, "back").mockImplementation(() => {}); navigation.replace.mockReset();
    container = document.createElement("div"); document.body.appendChild(container); root = createRoot(container);
    await act(async () => root.render(createElement(StartChatButton, { targetProfileId: "target-1" })));
    await act(async () => (container.querySelector("button") as HTMLButtonElement).click()); expect(fetchMock).not.toHaveBeenCalled();
    const field = document.querySelector("textarea") as HTMLTextAreaElement;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "予約の相談です"); field.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => (document.querySelector("form") as HTMLFormElement).dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/messaging/messages");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ recipientProfileId: "target-1", content: "予約の相談です" });
    expect(navigation.replace).toHaveBeenCalledWith("/messages/thread-1");
  });
});
