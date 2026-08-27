import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { REFRESH_COOKIE } from "@/lib/auth/cookies";
import {
  _resetFakePool,
  createFakeAdapter,
  FAKE_CONFIRMATION_CODE,
} from "@/lib/cognito/fake";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

describe("POST /api/identity/refresh-token", () => {
  beforeEach(() => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    cognitoMocks.adapter = createFakeAdapter();
  });

  it("有効な refresh_token cookie で新 access_token cookie を返す", async () => {
    const adapter = cognitoMocks.adapter!;
    await adapter.signUp("+15551234567", "Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!");

    const req = new NextRequest("http://localhost/api/identity/refresh-token", {
      method: "POST",
    });
    req.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=/);
  });

  it("refresh_token cookie 無しは 401 を返す", async () => {
    const req = new NextRequest("http://localhost/api/identity/refresh-token", {
      method: "POST",
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("refresh が失敗した場合は cookie を clear して 401 を返す", async () => {
    const req = new NextRequest("http://localhost/api/identity/refresh-token", {
      method: "POST",
    });
    req.cookies.set(REFRESH_COOKIE, "invalid-refresh-token");

    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=;/);
  });
});
