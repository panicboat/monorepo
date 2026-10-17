import { describe, expect, it } from "vitest";
import { resolveComposeKinds } from "./resolveComposeKinds";

describe("resolveComposeKinds", () => {
  it("offers a guest a post, a message and a review", () => {
    expect(resolveComposeKinds({ role: "guest" })).toEqual(["post", "message", "review"]);
  });

  it("offers a cast a post, a message and a karte", () => {
    expect(resolveComposeKinds({ role: "cast" })).toEqual(["post", "message", "karte"]);
  });

  it("offers only a post before the role is known", () => {
    expect(resolveComposeKinds({ role: null })).toEqual(["post"]);
  });
});
