import { describe, expect, it, vi } from "vitest";

import { submitManualCaption } from "./manual-caption-form.js";

describe("submitManualCaption", () => {
  it("keeps the entered text when the socket cannot send it", () => {
    const send = vi.fn().mockReturnValue(false);

    expect(submitManualCaption("  keep this caption  ", send)).toEqual({
      sent: false,
      text: "  keep this caption  ",
    });
    expect(send).toHaveBeenCalledWith("keep this caption");
  });

  it("clears the entered text only after the socket reports success", () => {
    const send = vi.fn().mockReturnValue(true);

    expect(submitManualCaption("send this caption", send)).toEqual({ sent: true, text: "" });
  });
});
