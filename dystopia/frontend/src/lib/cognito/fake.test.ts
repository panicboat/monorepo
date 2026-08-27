import { beforeEach, describe, expect, it } from "vitest";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "./fake";

describe("createFakeAdapter", () => {
  beforeEach(() => _resetFakePool());

  it("authenticates a user after confirmation", async () => {
    const adapter = createFakeAdapter();
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");

    expect(userSub).toMatch(/^[0-9a-f-]{36}$/);

    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);

    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");

    expect(tokens.accessToken).toMatch(/^eyJ/);
    expect(tokens.refreshToken).toMatch(/^fake-refresh:/);
  });

  it("rejects authentication for an unconfirmed user", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");

    await expect(adapter.initiateAuth("+15551234567", "Passw0rd!")).rejects.toMatchObject({
      name: "UserNotConfirmedException",
    });
  });

  it("rejects an incorrect confirmation code", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");

    await expect(adapter.confirmSignUp("+15551234567", "999999")).rejects.toMatchObject({
      name: "CodeMismatchException",
    });
  });

  it("uses the AWS SDK exception name for a duplicate sign-up", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");

    await expect(adapter.signUp("+15551234567", "Passw0rd!")).rejects.toMatchObject({
      name: "UsernameExistsException",
    });
  });

  it("uses the AWS SDK exception name for an unknown user", async () => {
    const adapter = createFakeAdapter();

    await expect(adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE)).rejects.toMatchObject({
      name: "UserNotFoundException",
    });
    await expect(adapter.initiateAuth("+15551234567", "Passw0rd!")).rejects.toMatchObject({
      name: "UserNotFoundException",
    });
    await expect(adapter.forgotPassword("+15551234567")).rejects.toMatchObject({
      name: "UserNotFoundException",
    });
    await expect(
      adapter.confirmForgotPassword("+15551234567", FAKE_CONFIRMATION_CODE, "AnotherPass!"),
    ).rejects.toMatchObject({
      name: "UserNotFoundException",
    });
  });

  it("uses the AWS SDK exception name for invalid credentials", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);

    await expect(adapter.initiateAuth("+15551234567", "WrongPassw0rd!")).rejects.toMatchObject({
      name: "NotAuthorizedException",
    });
    await expect(adapter.refreshTokens("not-a-refresh-token")).rejects.toMatchObject({
      name: "NotAuthorizedException",
    });
    await expect(
      adapter.confirmForgotPassword("+15551234567", "999999", "AnotherPass!"),
    ).rejects.toMatchObject({
      name: "CodeMismatchException",
    });
  });
});
