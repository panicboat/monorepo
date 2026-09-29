import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { splitContentByMentions, MentionText } from "./mention-text";
import type { MentionView } from "./post-view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

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
});
