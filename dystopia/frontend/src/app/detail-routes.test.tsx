// @vitest-environment happy-dom
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import MessagesLayout from "./messages/layout";
import PostPanel from "./@detail/(.)posts/[id]/page";
import ThreadPanel from "./messages/@thread/(.)[id]/page";
import DetailDefault from "./@detail/default";
import DetailCatchAll from "./@detail/[...catchAll]/page";
import ThreadDefault from "./messages/@thread/default";
import ThreadCatchAll from "./messages/@thread/[...catchAll]/page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const navigation = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "entry-1" }), useRouter: () => navigation }));
vi.mock("@/modules/post/components/PostDetail", () => ({ PostDetail: ({ postId }: { postId: string }) => <p>post:{postId}</p> }));
vi.mock("@/modules/messaging/components/MessageThread", () => ({ MessageThread: ({ threadId }: { threadId: string }) => <p>thread:{threadId}</p> }));
let providerMounts = 0;
vi.mock("@/modules/messaging", () => ({ MessagingPollingProvider: ({ children }: { children: React.ReactNode }) => { useEffect(() => { providerMounts++; }, []); return <>{children}</>; } }));
let root: ReturnType<typeof createRoot>;
afterEach(async () => { await act(async () => root?.unmount()); navigation.back.mockClear(); });
describe("detail routes", () => {
  it("renders no retained panel on direct or unrelated routes", () => { expect(DetailDefault()).toBeNull(); expect(DetailCatchAll()).toBeNull(); expect(ThreadDefault()).toBeNull(); expect(ThreadCatchAll()).toBeNull(); });
  it("opens a post at its URL and dismisses through router Back without adding history", async () => {
    root = createRoot(document.createElement("div")); const push = vi.spyOn(history, "pushState"); await act(async () => root.render(<PostPanel />));
    const panel = document.querySelector("[role='dialog']")!; expect(panel.textContent).toContain("post:entry-1");
    await act(async () => (panel.querySelector("button[aria-label='閉じる']") as HTMLButtonElement).click()); expect(navigation.back).toHaveBeenCalledTimes(1); expect(push).not.toHaveBeenCalled(); push.mockRestore();
  });
  it("retains one messaging provider while opening and closing a thread", async () => {
    providerMounts = 0; root = createRoot(document.createElement("div"));
    await act(async () => root.render(<MessagesLayout thread={null}><input defaultValue="list state" /></MessagesLayout>));
    await act(async () => root.render(<MessagesLayout thread={<ThreadPanel />}><input defaultValue="list state" /></MessagesLayout>));
    expect(document.querySelector("[role='dialog']")?.textContent).toContain("thread:entry-1"); expect(providerMounts).toBe(1);
    await act(async () => root.render(<MessagesLayout thread={null}><input defaultValue="list state" /></MessagesLayout>)); expect(providerMounts).toBe(1); expect(document.querySelector("[role='dialog']")).toBeNull();
  });
});
