import { describe, expect, it } from "vitest";
import { resolveComposeKinds } from "./resolveComposeKinds";

describe("resolveComposeKinds", () => {
  it("offers a guest a post, a message and a review", () => {
    expect(resolveComposeKinds({ role: "guest", karteAccess: false })).toEqual(["post", "message", "review"]);
  });

  it("offers a cast with karte access a post, a message and a karte entry", () => {
    expect(resolveComposeKinds({ role: "cast", karteAccess: true })).toEqual(["post", "message", "karte"]);
  });

  it("leaves the karte entry out for a cast without karte access", () => {
    expect(resolveComposeKinds({ role: "cast", karteAccess: false })).toEqual(["post", "message"]);
  });

  it("offers only a post before the role is known", () => {
    expect(resolveComposeKinds({ role: null, karteAccess: true })).toEqual(["post"]);
  });
});
