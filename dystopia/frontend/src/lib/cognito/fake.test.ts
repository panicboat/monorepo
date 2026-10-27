import { Code, ConnectError } from "@connectrpc/connect";
import { decodeJwt, importJWK, jwtVerify } from "jose";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "./fake";

const identity = vi.hoisted(() => ({ getAccount: vi.fn() }));

vi.mock("@/lib/grpc", () => ({
  identityClient: { getAccount: identity.getAccount },
}));

describe("createFakeAdapter", () => {
  beforeEach(() => {
    _resetFakePool();
    identity.getAccount.mockReset();
  });

  it("authenticates a user after confirmation", async () => {
    const adapter = createFakeAdapter();
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");

    expect(userSub).toMatch(/^[0-9a-f-]{36}$/);

    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);

    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");

    expect(tokens.accessToken).toMatch(/^eyJ/);
    expect(tokens.refreshToken).toMatch(/^fake-refresh:/);
  });

  it("signs in a seeded account with the account id from the monolith seeds as its sub", async () => {
    const adapter = createFakeAdapter();

    const tokens = await adapter.initiateAuth("+819000000101", "password");

    expect(decodeJwt(tokens.accessToken).sub).toBe("11111111-1111-4111-8111-111111111111");
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

  it("signs refreshed tokens that another load of the module can verify", async () => {
    const { accessToken } = await createFakeAdapter().refreshTokens(
      "fake-refresh:11111111-1111-4111-8111-111111111111",
    );
    vi.resetModules();
    const reloaded = await import("./fake");
    const key = await importJWK((await reloaded.fakeJwks()).keys[0]);

    await expect(jwtVerify(accessToken, key, { issuer: "fake-issuer" })).resolves.toBeTruthy();
  });

  describe("releaseIncompleteSignUp", () => {
    it("returns false for an unknown user", async () => {
      const adapter = createFakeAdapter();

      await expect(adapter.releaseIncompleteSignUp("+15551234567")).resolves.toBe(false);
      expect(identity.getAccount).not.toHaveBeenCalled();
    });

    it("deletes an unconfirmed user without asking the monolith", async () => {
      const adapter = createFakeAdapter();
      await adapter.signUp("+15551234567", "Passw0rd!");

      await expect(adapter.releaseIncompleteSignUp("+15551234567")).resolves.toBe(true);

      expect(identity.getAccount).not.toHaveBeenCalled();
      await expect(adapter.signUp("+15551234567", "AnotherPass!")).resolves.toBeTruthy();
    });

    it("deletes a confirmed user when the monolith has no account for the sub", async () => {
      const adapter = createFakeAdapter();
      const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!");
      await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
      identity.getAccount.mockRejectedValue(new ConnectError("account not found", Code.NotFound));

      await expect(adapter.releaseIncompleteSignUp("+15551234567")).resolves.toBe(true);

      expect(identity.getAccount).toHaveBeenCalledWith({ sub: userSub });
      await expect(adapter.initiateAuth("+15551234567", "Passw0rd!")).rejects.toMatchObject({
        name: "UserNotFoundException",
      });
    });

    it("keeps a confirmed user that has an account", async () => {
      const adapter = createFakeAdapter();
      await adapter.signUp("+15551234567", "Passw0rd!");
      await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
      identity.getAccount.mockResolvedValue({ account: { id: "account-id" } });

      await expect(adapter.releaseIncompleteSignUp("+15551234567")).resolves.toBe(false);

      await expect(adapter.initiateAuth("+15551234567", "Passw0rd!")).resolves.toBeTruthy();
    });

    it("propagates a lookup failure other than not found and keeps the user", async () => {
      const adapter = createFakeAdapter();
      await adapter.signUp("+15551234567", "Passw0rd!");
      await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
      identity.getAccount.mockRejectedValue(new ConnectError("unavailable", Code.Unavailable));

      await expect(adapter.releaseIncompleteSignUp("+15551234567")).rejects.toMatchObject({
        code: Code.Unavailable,
      });

      await expect(adapter.initiateAuth("+15551234567", "Passw0rd!")).resolves.toBeTruthy();
    });
  });
});
