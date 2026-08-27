import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import {
  _resetFakePool,
  createFakeAdapter,
  FAKE_CONFIRMATION_CODE,
} from "@/lib/cognito/fake";
import { GET } from "./route";

vi.mock("@/lib/grpc", () => ({
  identityClient: {
    getAccount: vi.fn(),
  },
}));

const { identityClient } = await import("@/lib/grpc");
const identity = identityClient as unknown as {
  getAccount: ReturnType<typeof vi.fn>;
};

describe("GET /api/identity/me", () => {
  beforeEach(() => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    identity.getAccount.mockReset();
  });

  it("access token の subject に紐づく account を返す", async () => {
    const adapter = createFakeAdapter();
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

  it("access token を検証できない場合は 401 を返す", async () => {
    const req = new NextRequest("http://localhost/api/identity/me");
    req.cookies.set(ACCESS_COOKIE, "not.a.jwt");

    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});
