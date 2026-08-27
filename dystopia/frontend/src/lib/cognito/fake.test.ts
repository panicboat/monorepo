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

    await expect(adapter.initiateAuth("+15551234567", "Passw0rd!")).rejects.toThrow(/UserNotConfirmed/);
  });

  it("rejects an incorrect confirmation code", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");

    await expect(adapter.confirmSignUp("+15551234567", "999999")).rejects.toThrow(/CodeMismatch/);
  });
});
