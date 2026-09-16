import { describe, expect, it } from "vitest";

import { createRoomLink } from "./room-link.js";

describe("createRoomLink", () => {
  it("places the join token in the fragment after the room route", () => {
    expect(createRoomLink("https://dystopia.city", "room_123", "token_123")).toBe(
      "https://dystopia.city/translate/rooms/room_123#token_123",
    );
  });
});
