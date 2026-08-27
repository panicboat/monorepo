import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "./fake";
import { verifyAccessToken } from "./jwks";

const cognitoAdapter = process.env.COGNITO_ADAPTER;

describe("verifyAccessToken in fake mode", () => {
  beforeEach(() => {
    process.env.COGNITO_ADAPTER = "fake";
    _resetFakePool();
  });

  afterEach(() => {
    if (cognitoAdapter === undefined) {
      delete process.env.COGNITO_ADAPTER;
    } else {
      process.env.COGNITO_ADAPTER = cognitoAdapter;
    }
  });

  it("returns the user sub for an issued access token", async () => {
    const adapter = createFakeAdapter();
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");

    await expect(verifyAccessToken(tokens.accessToken)).resolves.toEqual({ sub: userSub });
  });

  it("rejects a malformed token", async () => {
    await expect(verifyAccessToken("not.a.jwt")).rejects.toThrow();
  });
});
