// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePostSheetStore } from "@/stores/postSheetStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("./PostDetailContent", () => ({ PostDetailContent: ({ postId }: { postId: string }) => <div>detail:{postId}</div> }));

const { PostDetailSheet } = await import("./PostDetailSheet");

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
});

afterEach(() => {
  document.body.innerHTML = "";
});

async function mount() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(PostDetailSheet));
  });
}

describe("PostDetailSheet", () => {
  it("shows nothing before a post is opened", async () => {
    await mount();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("shows the opened post's detail and closes through the store", async () => {
    await mount();
    await act(async () => usePostSheetStore.getState().openPost("post-1"));

    expect(document.body.textContent).toContain("投稿の詳細");
    expect(document.body.textContent).toContain("detail:post-1");

    await act(async () => {
      (document.querySelector('button[aria-label="閉じる"]') as HTMLButtonElement).click();
    });

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "post-1", open: false });
  });
});
