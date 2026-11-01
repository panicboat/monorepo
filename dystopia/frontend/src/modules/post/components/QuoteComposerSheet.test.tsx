// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PostView } from "@/modules/post/lib/post-view";
import { useQuoteComposeStore } from "@/stores/quoteComposeStore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  authFetch: vi.fn(),
  mutate: vi.fn(),
  notifyPostCreated: vi.fn(),
  revalidatePostLists: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: () => {} }) }));
vi.mock("swr", async (importOriginal) => ({ ...(await importOriginal<typeof import("swr")>()), useSWRConfig: () => ({ mutate: mocks.mutate }) }));
vi.mock("@/lib/auth", () => ({ authFetch: mocks.authFetch }));
vi.mock("@/stores/postFeedStore", () => ({
  usePostFeedStore: (selector: (state: { notifyPostCreated: () => void }) => unknown) =>
    selector({ notifyPostCreated: mocks.notifyPostCreated }),
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: { show: (message: string) => void }) => unknown) =>
    selector({ show: mocks.showToast }),
}));
vi.mock("../lib/revalidate", () => ({ revalidatePostLists: mocks.revalidatePostLists }));
vi.mock("@/modules/profile/hooks", () => ({ useProfile: () => ({ profile: { isPrivate: false } }) }));
vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => null }));

const { QuoteComposerSheet } = await import("./QuoteComposerSheet");

const original: PostView = {
  id: "original-1",
  authorProfileId: "author-2",
  content: "引用元の本文",
  media: [],
  createdAt: "2026-11-01T00:00:00.000Z",
  publishedAt: "2026-11-01T00:00:00.000Z",
  expiresAt: "",
  author: { profileId: "author-2", displayName: "引用元花子", username: "hanako", avatarUrl: "", isPrivate: true, role: null, industry: "" },
  likesCount: 0,
  commentsCount: 0,
  visibility: "public",
  hashtags: [],
  mentions: [],
  liked: false,
  schedule: null,
  pinned: false,
  quotedPost: null,
  quotesCount: 0,
};

let root: Root;
let container: HTMLElement;

const dialog = () => document.querySelector('[role="dialog"]');

async function write(text: string) {
  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(textarea, text);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function submit() {
  await act(async () => {
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

beforeEach(async () => {
  mocks.authFetch.mockReset().mockResolvedValue({});
  mocks.mutate.mockReset();
  mocks.notifyPostCreated.mockReset();
  mocks.revalidatePostLists.mockReset();
  mocks.showToast.mockReset();
  useQuoteComposeStore.setState({ post: null, session: 0, open: false });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(QuoteComposerSheet)));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

describe("QuoteComposerSheet", () => {
  it("shows nothing until a post is quoted", () => {
    expect(dialog()).toBeNull();
  });

  it("shows the original in a frame and submits quotedPostId with the body", async () => {
    await act(async () => useQuoteComposeStore.getState().openQuote(original));

    expect(dialog()?.textContent).toContain("引用して投稿");
    expect(dialog()?.textContent).toContain("引用元花子");
    expect(dialog()?.textContent).toContain("引用元の本文");
    expect(dialog()?.querySelector('[aria-label="鍵付き"]')).not.toBeNull();
    expect(dialog()?.querySelector("a[href='/posts/original-1']")).toBeNull();

    await write("これは同意 #引用");
    await submit();

    expect(mocks.authFetch).toHaveBeenCalledTimes(1);
    expect(mocks.authFetch.mock.calls[0][0]).toBe("/api/posts");
    expect(mocks.authFetch.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: { content: "これは同意 #引用", quotedPostId: "original-1", hashtags: ["引用"] },
    });
    expect(mocks.notifyPostCreated).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePostLists).toHaveBeenCalledTimes(1);
    expect(mocks.showToast.mock.calls).toEqual([["投稿しました"]]);
    expect(useQuoteComposeStore.getState().open).toBe(false);
  });

  it("keeps the written body and shows the error when the original can no longer be quoted", async () => {
    mocks.authFetch.mockRejectedValue(new Error("この投稿は引用できません"));
    await act(async () => useQuoteComposeStore.getState().openQuote(original));

    await write("これは同意");
    await submit();

    expect(dialog()?.querySelector('[role="alert"]')?.textContent).toBe("この投稿は引用できません");
    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("これは同意");
    expect(useQuoteComposeStore.getState().open).toBe(true);
    expect(mocks.notifyPostCreated).not.toHaveBeenCalled();
  });

  it("starts empty each time it is opened", async () => {
    await act(async () => useQuoteComposeStore.getState().openQuote(original));
    await write("書きかけ");
    await act(async () => useQuoteComposeStore.getState().openQuote({ ...original, id: "original-2", content: "別の投稿" }));

    expect((document.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
    expect(dialog()?.textContent).toContain("別の投稿");
  });
});
