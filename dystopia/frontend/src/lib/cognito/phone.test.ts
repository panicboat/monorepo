import { describe, expect, it } from "vitest";
import { normalizePhoneNumber, usernameForPhone } from "./phone";

describe("normalizePhoneNumber", () => {
  it("converts a domestic number with a leading 0 to E.164", () => {
    expect(normalizePhoneNumber("08054758714")).toBe("+818054758714");
  });

  it("strips hyphens before converting", () => {
    expect(normalizePhoneNumber("080-5475-8714")).toBe("+818054758714");
  });

  it("strips spaces before converting", () => {
    expect(normalizePhoneNumber(" 080 5475 8714 ")).toBe("+818054758714");
  });

  it("leaves an already-E.164 number unchanged", () => {
    expect(normalizePhoneNumber("+818054758714")).toBe("+818054758714");
  });

  it("strips spaces and hyphens from an already-E.164 number", () => {
    expect(normalizePhoneNumber("+81 80-5475-8714")).toBe("+818054758714");
  });

  it("does not double-prefix a number missing the leading 0", () => {
    expect(normalizePhoneNumber("8054758714")).toBe("+818054758714");
  });
});

describe("usernameForPhone", () => {
  it("is deterministic for the same phone number", () => {
    expect(usernameForPhone("08054758714")).toBe(usernameForPhone("08054758714"));
  });

  it("normalizes before hashing, so equivalent inputs collide", () => {
    expect(usernameForPhone("08054758714")).toBe(usernameForPhone("080-5475-8714"));
    expect(usernameForPhone("08054758714")).toBe(usernameForPhone("+818054758714"));
  });

  it("differs for different phone numbers", () => {
    expect(usernameForPhone("08054758714")).not.toBe(usernameForPhone("09011112222"));
  });

  it("does not look like a phone number (Cognito rejects that as a SignUp Username)", () => {
    expect(usernameForPhone("08054758714")).not.toMatch(/^\+?\d+$/);
  });
});
