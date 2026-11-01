// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/modules/profile/components/ActingProfileLabel", () => ({ ActingProfileLabel: () => <span>acting-profile</span> }));
vi.mock("@/modules/post/hooks/useAddComment", () => ({
  useAddComment: () => ({ addComment: vi.fn(), submitting: false, error: null }),
}));

const { CommentComposer } = await import("./CommentComposer");

afterEach(() => {
  document.body.innerHTML = "";
});

async function render(root: Root, focusRequest?: number) {
  await act(async () => {
    root.render(createElement(CommentComposer, { postId: "post-1", focusRequest }));
  });
}

function mountRoot() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  return createRoot(container);
}

const textarea = () => document.querySelector("textarea");

describe("CommentComposer focus", () => {
  it("leaves the input unfocused without a request", async () => {
    await render(mountRoot());

    expect(document.activeElement).not.toBe(textarea());
  });

  it("focuses the input when mounted with a request", async () => {
    await render(mountRoot(), 1);

    expect(document.activeElement).toBe(textarea());
  });

  it("focuses the input again on each new request", async () => {
    const root = mountRoot();
    await render(root, 1);
    textarea()!.blur();
    expect(document.activeElement).not.toBe(textarea());

    await render(root, 2);

    expect(document.activeElement).toBe(textarea());
  });
});
