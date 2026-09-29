// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { splitContentByMentions, MentionText } from "./mention-text";
import type { MentionView } from "./post-view";

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("splitContentByMentions", () => {
  it("splits content into text and mention parts", () => {
    const mentions: MentionView[] = [
      { accountId: "a1", username: "alice", position: 3, length: 6 },
    ];

    const parts = splitContentByMentions("hi @alice!", mentions);

    expect(parts).toEqual([
      { type: "text", value: "hi " },
      { type: "mention", accountId: "a1", username: "alice", value: "@alice" },
      { type: "text", value: "!" },
    ]);
  });

  it("returns the whole content as text when there are no mentions", () => {
    expect(splitContentByMentions("hello", [])).toEqual([
      { type: "text", value: "hello" },
    ]);
  });

  it("treats a mention with an empty username as plain text", () => {
    const mentions: MentionView[] = [
      { accountId: "a1", username: "", position: 0, length: 6 },
    ];

    const parts = splitContentByMentions("@alice hi", mentions);

    expect(parts).toEqual([{ type: "text", value: "@alice hi" }]);
  });

  it("computes positions by codepoint, not UTF-16 code unit", () => {
    // One code point can occupy two UTF-16 code units.
    const mentions: MentionView[] = [
      { accountId: "a1", username: "alice", position: 2, length: 6 },
    ];

    const parts = splitContentByMentions("🎉 @alice", mentions);

    expect(parts).toEqual([
      { type: "text", value: "🎉 " },
      { type: "mention", accountId: "a1", username: "alice", value: "@alice" },
    ]);
  });

  it("sorts out-of-order mentions by position", () => {
    const mentions: MentionView[] = [
      { accountId: "b1", username: "bob", position: 10, length: 4 },
      { accountId: "a1", username: "alice", position: 0, length: 6 },
    ];

    const parts = splitContentByMentions("@alice hi @bob", mentions);

    expect(parts.map((p) => p.value)).toEqual(["@alice", " hi ", "@bob"]);
  });
});

describe("MentionText", () => {
  it("renders mention parts as clickable spans pointing at /u/{username}", () => {
    const mentions: MentionView[] = [
      { accountId: "a1", username: "alice", position: 0, length: 6 },
    ];

    const html = renderToStaticMarkup(
      <MentionText content="@alice hi" mentions={mentions} />,
    );

    expect(html).toContain("@alice");
    expect(html).not.toContain("<a ");
  });

  it("navigates to a mention on Enter", async () => {
    routerMocks.push.mockClear();
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <MentionText
          content="@alice hi"
          mentions={[{ accountId: "a1", username: "alice", position: 0, length: 6 }]}
        />,
      );
    });

    const mention = container.querySelector('[role="link"]');
    expect(mention).not.toBeNull();

    await act(async () => {
      mention!.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
      );
    });

    expect(routerMocks.push).toHaveBeenCalledWith("/u/alice");

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
