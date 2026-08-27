import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import {
  _resetFakePool,
  FAKE_CONFIRMATION_CODE,
  createFakeAdapter,
} from "@/lib/cognito/fake";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

describe("POST /api/identity/confirm-forgot-password", () => {
  beforeEach(async () => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    const fake = createFakeAdapter();
    cognitoMocks.adapter = fake;
    await fake.signUp("+15551234567", "Passw0rd!");
  });

  it("returns 200 for a valid password-reset code", async () => {
    const req = new NextRequest("http://localhost/api/identity/confirm-forgot-password", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: "+15551234567",
        code: FAKE_CONFIRMATION_CODE,
        newPassword: "AnotherPass!",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("returns 400 for an invalid password-reset code", async () => {
    const req = new NextRequest("http://localhost/api/identity/confirm-forgot-password", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: "+15551234567",
        code: "999999",
        newPassword: "AnotherPass!",
      }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "認証コードが正しくありません" });
  });
});
