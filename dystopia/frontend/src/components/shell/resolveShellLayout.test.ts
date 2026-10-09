import { describe, expect, it } from "vitest";
import { resolveShellLayout } from "./resolveShellLayout";

describe("resolveShellLayout", () => {
  it("fits a message thread into the viewport", () => {
    expect(resolveShellLayout("/messages/01a1217f-f9f8-71c6-9a73-81d5b3b5e74c")).toBe("viewport");
  });

  it("lets every other page scroll the document", () => {
    for (const pathname of ["/", "/messages", "/messages/", "/notifications", "/u/yuna", "/posts/abc", "/messages/abc/extra"]) {
      expect(resolveShellLayout(pathname)).toBe("scrolling");
    }
  });
});
