import { describe, expect, it } from "vitest";

import type { Caption } from "../../shared/meeting.js";
import { primaryCaptionText } from "./caption-display.js";

const caption = {
  sourceLanguage: "en-US",
  sourceText: "The deadline is Friday.",
  translatedText: "締め切りは金曜日です。",
} as Caption;

describe("primaryCaptionText", () => {
  it("uses the translation when the configured display language differs from the source", () => {
    expect(primaryCaptionText(caption, "ja")).toBe("締め切りは金曜日です。");
  });

  it("uses the source text when it matches the configured display language", () => {
    expect(primaryCaptionText(caption, "en")).toBe("The deadline is Friday.");
  });

  it("keeps the source text visible while translation is pending", () => {
    expect(primaryCaptionText({ ...caption, translatedText: undefined }, "ja")).toBe(
      "The deadline is Friday.",
    );
  });
});
