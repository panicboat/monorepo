import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import {
  _resetFakePool,
  createFakeAdapter,
  FAKE_CONFIRMATION_CODE,
} from "@/lib/cognito/fake";
import { GET } from "./route";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

vi.mock("@/lib/grpc", () => ({
  identityClient: {
    getAccount: vi.fn(),
  },
}));

const { identityClient } = await import("@/lib/grpc");
const identity = identityClient as unknown as {
  getAccount: ReturnType<typeof vi.fn>;
};

async function issueTokens() {
  const adapter = cognitoMocks.adapter!;
  await adapter.signUp("+15551234567", "Passw0rd!");
  await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
  return adapter.initiateAuth("+15551234567", "Passw0rd!");
}

describe("GET /api/identity/me", () => {
  beforeEach(() => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    identity.getAccount.mockReset();
    cognitoMocks.adapter = createFakeAdapter();
  });

  it("access token の subject に紐づく account を返す", async () => {
    const adapter = cognitoMocks.adapter!;
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!");
    identity.getAccount.mockResolvedValue({ account: { id: userSub, role: 1 } });

    const req = new NextRequest("http://localhost/api/identity/me");
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
    const res = await GET(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account: { id: userSub, role: 1 },
    });
    expect(identity.getAccount).toHaveBeenCalledWith(
      { sub: userSub },
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("access token cookie 無しは 401 を返す", async () => {
    const req = new NextRequest("http://localhost/api/identity/me");

    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it("期限切れ access token と有効な refresh token では session を更新して account を返す", async () => {
    const adapter = cognitoMocks.adapter!;
    const { userSub } = await adapter.signUp("+15551234567", "Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!");
    identity.getAccount.mockResolvedValue({ account: { id: userSub, role: 1 } });

    const req = new NextRequest("http://localhost/api/identity/me");
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
    req.cookies.set(REFRESH_COOKIE, tokens.refreshToken);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1);

    try {
      const res = await GET(req);

      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        account: { id: userSub, role: 1 },
      });
      expect(res.headers.get("Set-Cookie")).toMatch(/access_token=/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("期限切れ access token と refresh token 無しは cookie を clear して 401 を返す", async () => {
    const tokens = await issueTokens();
    const req = new NextRequest("http://localhost/api/identity/me");
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1);

    try {
      const res = await GET(req);

      expect(res.status).toBe(401);
      expect(res.headers.get("Set-Cookie")).toMatch(/access_token=;/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("期限切れ access token と無効な refresh token は cookie を clear して 401 を返す", async () => {
    const tokens = await issueTokens();
    const req = new NextRequest("http://localhost/api/identity/me");
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);
    req.cookies.set(REFRESH_COOKIE, "invalid-refresh-token");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1);

    try {
      const res = await GET(req);

      expect(res.status).toBe(401);
      expect(res.headers.get("Set-Cookie")).toMatch(/access_token=;/);
    } finally {
      vi.useRealTimers();
    }
  });
});
