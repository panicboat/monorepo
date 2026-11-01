import { describe, expect, it } from "vitest";
import { resolveNotificationOpen } from "./open";

const base = { profileId: "p2", to: "/posts/1", selectableProfileIds: ["p1", "p2"], activeProfileId: "p1" };

describe("resolveNotificationOpen", () => {
  it("switches to the receiving profile when it is another of the account's profiles", () => {
    expect(resolveNotificationOpen(base)).toEqual({ switchTo: "p2", destination: "/posts/1" });
  });

  it("goes straight to the page when the receiving profile is already active", () => {
    expect(resolveNotificationOpen({ ...base, activeProfileId: "p2" })).toEqual({ switchTo: null, destination: "/posts/1" });
  });

  it("opens home without switching when the account cannot act as the receiving profile", () => {
    expect(resolveNotificationOpen({ ...base, profileId: "disabled-profile" })).toEqual({ switchTo: null, destination: "/" });
    expect(resolveNotificationOpen({ ...base, profileId: null })).toEqual({ switchTo: null, destination: "/" });
    expect(resolveNotificationOpen({ ...base, activeProfileId: "p2", selectableProfileIds: ["p1"] })).toEqual({
      switchTo: null,
      destination: "/",
    });
  });

  it("keeps the query of the quotes tab in the destination", () => {
    expect(resolveNotificationOpen({ ...base, to: "/posts/1?tab=quotes" }).destination).toBe("/posts/1?tab=quotes");
  });

  it("opens the notification list instead of a page outside the app", () => {
    for (const to of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "posts/1", "/\t/evil.example", "/\n/evil.example"]) {
      expect(resolveNotificationOpen({ ...base, to }).destination).toBe("/notifications");
    }
  });
});
