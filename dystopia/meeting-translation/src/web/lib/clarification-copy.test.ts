import { describe, expect, it } from "vitest";

import type { ServerMessage } from "../../shared/meeting.js";
import { clarificationRequestCopy } from "./clarification-copy.js";

const request = {
  type: "clarification:requested",
  captionId: "caption_123",
  requester: {
    id: "participant_123",
    displayName: "Alex",
    speechLanguage: "en-US",
    displayLanguage: "en",
  },
} satisfies ServerMessage;

describe("clarificationRequestCopy", () => {
  it("renders a server clarification event with the requester name in Japanese", () => {
    expect(clarificationRequestCopy(request, "ja")).toBe(
      "Alexさんがこの発言の確認を依頼しました。",
    );
  });

  it("renders a server clarification event with the requester name in English", () => {
    expect(clarificationRequestCopy(request, "en")).toBe(
      "Alex requested clarification for this statement.",
    );
  });
});
