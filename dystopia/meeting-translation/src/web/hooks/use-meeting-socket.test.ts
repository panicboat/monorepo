import { describe, expect, it } from "vitest";

import type { ServerMessage } from "../../shared/meeting.js";
import { clarificationRequestCopy } from "../lib/clarification-copy.js";
import { reduceMeetingSocketData } from "./use-meeting-socket.js";

describe("reduceMeetingSocketData", () => {
  it("carries a clarification event from the socket into localized UI copy", () => {
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

    const state = reduceMeetingSocketData(
      { captions: [], participants: [] },
      request,
    );

    expect(state.clarificationRequest).toEqual(request);
    expect(clarificationRequestCopy(state.clarificationRequest!, "ja")).toBe(
      "Alexさんがこの発言の確認を依頼しました。",
    );
  });
});
