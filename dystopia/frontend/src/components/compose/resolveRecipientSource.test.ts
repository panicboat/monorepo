import { describe, expect, it } from "vitest";
import { resolveRecipientSource } from "./resolveRecipientSource";

describe("resolveRecipientSource", () => {
  it("starts a karte entry from the guests among the followers and searches every guest", () => {
    expect(resolveRecipientSource("karte", "cast")).toMatchObject({ initial: "followers", role: "guest", search: "everyone" });
  });

  it("starts a review from the casts the viewer follows and searches every cast", () => {
    expect(resolveRecipientSource("review", "guest")).toMatchObject({ initial: "following", role: "cast", search: "everyone" });
  });

  it("starts a message from everyone the viewer follows", () => {
    expect(resolveRecipientSource("message", "cast")).toMatchObject({ initial: "following", role: null, search: "everyone" });
  });

  it("keeps a guest's message search among the profiles they follow", () => {
    expect(resolveRecipientSource("message", "guest")).toMatchObject({ initial: "following", role: null, search: "among-initial" });
  });
});
