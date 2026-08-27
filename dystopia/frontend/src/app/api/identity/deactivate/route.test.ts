import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import {
  _resetFakePool,
  createFakeAdapter,
  FAKE_CONFIRMATION_CODE,
} from "@/lib/cognito/fake";
import { POST } from "./route";

const cognitoMocks = vi.hoisted(() => ({
  globalSignOut: vi.fn(),
}));

vi.mock("@/lib/grpc", () => ({
  identityClient: {
    deactivateAccount: vi.fn(),
  },
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => ({ globalSignOut: cognitoMocks.globalSignOut }),
}));

const { identityClient } = await import("@/lib/grpc");
const identity = identityClient as unknown as {
  deactivateAccount: ReturnType<typeof vi.fn>;
};

describe("POST /api/identity/deactivate", () => {
  beforeEach(() => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    identity.deactivateAccount.mockReset();
    identity.deactivateAccount.mockResolvedValue({});
    cognitoMocks.globalSignOut.mockReset();
    cognitoMocks.globalSignOut.mockResolvedValue(undefined);
  });

  it("account を無効化して cookie を clear する", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!");
    const req = new NextRequest("http://localhost/api/identity/deactivate", {
      method: "POST",
    });
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie") ?? "").toMatch(/access_token=;/);
    expect(identity.deactivateAccount).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ headers: expect.any(Object) }),
    );
    expect(cognitoMocks.globalSignOut).toHaveBeenCalledWith(tokens.accessToken);
  });

  it("access token cookie 無しは 401 を返す", async () => {
    const req = new NextRequest("http://localhost/api/identity/deactivate", {
      method: "POST",
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });
});
