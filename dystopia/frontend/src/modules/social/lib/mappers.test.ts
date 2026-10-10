import { describe, expect, it } from "vitest";
import { create } from "@bufbuild/protobuf";
import { ProfileSchema } from "@/stub/profile/v1/service_pb";
import { profileToSocialProfile } from "./mappers";

describe("profileToSocialProfile", () => {
  it("carries the identity of the profile and whether it is locked", () => {
    const view = profileToSocialProfile(
      create(ProfileSchema, { id: "p1", username: "yuna", displayName: "ゆな", avatarUrl: "https://example.com/a.png", isPrivate: true, role: 2 })
    );

    expect(view).toEqual({
      profileId: "p1",
      username: "yuna",
      displayName: "ゆな",
      avatarUrl: "https://example.com/a.png",
      isPrivate: true,
      role: "cast",
    });
  });

  it("names the role of a guest and leaves an unknown role empty", () => {
    expect(profileToSocialProfile(create(ProfileSchema, { id: "p1", role: 1 })).role).toBe("guest");
    expect(profileToSocialProfile(create(ProfileSchema, { id: "p1", role: 0 })).role).toBeNull();
  });
});
