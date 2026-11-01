// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QuotedPostView } from "@/modules/post/lib/post-view";
import { usePostSheetStore } from "@/stores/postSheetStore";
import { QuoteFrame } from "./QuoteFrame";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {} }) }));

const quotedOf = (overrides: Partial<QuotedPostView> = {}): QuotedPostView => ({
  available: true,
  id: "quoted-1",
  author: { profileId: "author-2", displayName: "引用元花子", username: "hanako", avatarUrl: "", isPrivate: false, role: null, industry: "" },
  content: "引用元の本文",
  media: [],
  publishedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  schedule: null,
  mentions: [],
  hashtags: [],
  ...overrides,
});

const stopNavigation = (event: Event) => event.preventDefault();

beforeEach(() => {
  usePostSheetStore.setState({ postId: null, session: 0, open: false });
  document.addEventListener("click", stopNavigation);
});

afterEach(() => {
  document.removeEventListener("click", stopNavigation);
  document.body.innerHTML = "";
});

async function mount(quoted: QuotedPostView, interactive?: boolean) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  await act(async () => {
    createRoot(container).render(createElement(QuoteFrame, { quoted, interactive }));
  });
  return container;
}

async function click(element: Element, init: MouseEventInit = {}) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init }));
  });
}

// next/image rewrites `src` to `/_next/image?url=<encoded>&w=...`, so match on the encoded original url.
const imageWithUrl = (container: Element, url: string) => container.querySelector(`img[src*="${encodeURIComponent(url)}"]`);

describe("QuoteFrame", () => {
  it("shows the author with the lock mark, the time, the body, and the images", async () => {
    const container = await mount(
      quotedOf({
        author: { profileId: "author-2", displayName: "引用元花子", username: "hanako", avatarUrl: "", isPrivate: true, role: null, industry: "" },
        media: [
          { id: "m1", mediaType: "image", url: "https://example.com/full-1.jpg", thumbnailUrl: "https://example.com/thumb-1.jpg", mediaId: "media-1" },
          { id: "m2", mediaType: "image", url: "https://example.com/full-2.jpg", thumbnailUrl: "", mediaId: "media-2" },
        ],
      })
    );

    expect(container.textContent).toContain("引用元花子");
    expect(container.textContent).toContain("@hanako");
    expect(container.querySelector('[aria-label="鍵付き"]')).not.toBeNull();
    expect(container.textContent).toContain("5m ago");
    expect(container.textContent).toContain("引用元の本文");
    expect(imageWithUrl(container, "https://example.com/thumb-1.jpg")).not.toBeNull();
    expect(imageWithUrl(container, "https://example.com/full-2.jpg")).not.toBeNull();
  });

  it("shows at most four images and does not enlarge them", async () => {
    const media = Array.from({ length: 5 }, (_, i) => ({
      id: `m${i}`,
      mediaType: "image" as const,
      url: `https://example.com/full-${i}.jpg`,
      thumbnailUrl: `https://example.com/thumb-${i}.jpg`,
      mediaId: `media-${i}`,
    }));
    const container = await mount(quotedOf({ media }));

    expect(container.querySelectorAll("img")).toHaveLength(4);
    expect(container.querySelector("button")).toBeNull();
  });

  it("clamps a long body with line-clamp", async () => {
    const container = await mount(quotedOf({ content: "長い本文。".repeat(100) }));

    expect(container.querySelector(".line-clamp-4")?.textContent).toContain("長い本文。");
  });

  it("shows a video as a tile without playing it inside the frame", async () => {
    const container = await mount(
      quotedOf({
        media: [
          { id: "v1", mediaType: "video", url: "https://example.com/video-1.mp4", thumbnailUrl: "", mediaId: "media-v1" },
          { id: "v2", mediaType: "video", url: "https://example.com/video-2.mp4", thumbnailUrl: "https://example.com/video-2.jpg", mediaId: "media-v2" },
        ],
      })
    );

    expect(container.querySelector("video")).toBeNull();
    expect(container.textContent).toContain("動画");
    expect(imageWithUrl(container, "https://example.com/video-2.jpg")).not.toBeNull();
  });

  it("shows the schedule card and no empty body line for an announcement without words", async () => {
    const container = await mount(
      quotedOf({ content: "", schedule: { workDate: "2026-11-02", startTime: "10:00", endTime: "18:00" } }),
      true
    );

    expect(container.textContent).toContain("予定");
    expect(container.textContent).toContain("10:00〜18:00");
    expect(container.querySelector(".line-clamp-4")).toBeNull();
    expect(container.querySelectorAll("a a")).toHaveLength(0);
  });

  it("shows only この投稿は表示できません when unavailable, with no link", async () => {
    const container = await mount(quotedOf({ available: false, id: "", author: null, content: "", publishedAt: "" }), true);

    expect(container.textContent).toBe("この投稿は表示できません");
    expect(container.querySelector("a")).toBeNull();
  });

  it("links to the original post when available", async () => {
    const container = await mount(quotedOf(), true);

    await click(container.querySelector('a[href="/posts/quoted-1"]')!);

    expect(usePostSheetStore.getState()).toMatchObject({ postId: "quoted-1", open: true });
  });

  it("leaves a modified click to the link", async () => {
    const container = await mount(quotedOf(), true);

    await click(container.querySelector('a[href="/posts/quoted-1"]')!, { metaKey: true });

    expect(usePostSheetStore.getState().open).toBe(false);
  });

  it("shows no link unless it is interactive", async () => {
    const container = await mount(quotedOf());

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("引用元の本文");
  });
});
