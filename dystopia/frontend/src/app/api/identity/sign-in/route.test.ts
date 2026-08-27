import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createFakeAdapter,
  FAKE_CONFIRMATION_CODE,
  _resetFakePool,
} from "@/lib/cognito/fake";
import { POST } from "./route";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/grpc", () => ({
  identityClient: {
    getAccount: vi.fn(),
    reactivateAccount: vi.fn(),
  },
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

const identityMod = await import("@/lib/grpc");
const identity = identityMod.identityClient as unknown as {
  getAccount: ReturnType<typeof vi.fn>;
  reactivateAccount: ReturnType<typeof vi.fn>;
};

const phoneNumber = "+15551234567";
const password = "Passw0rd!Passw0rd!";

function signInRequest(role: number, requestPassword = password): NextRequest {
  return new NextRequest("http://localhost/api/identity/sign-in", {
    method: "POST",
    body: JSON.stringify({ phoneNumber, password: requestPassword, role }),
  });
}

describe("POST /api/identity/sign-in", () => {
  let sub: string;

  beforeEach(async () => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";

    const fake = createFakeAdapter();
    cognitoMocks.adapter = fake;
    ({ userSub: sub } = await fake.signUp(phoneNumber, password));
    await fake.confirmSignUp(phoneNumber, FAKE_CONFIRMATION_CODE);

    identity.getAccount.mockReset();
    identity.reactivateAccount.mockReset();
  });

  it("returns the matching active account and auth cookies", async () => {
    identity.getAccount.mockResolvedValue({
      account: { id: sub, role: 1, deactivatedAt: undefined },
    });

    const res = await POST(signInRequest(1));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account: { id: sub, role: 1 },
      reactivated: false,
    });
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=/);
  });

  it("rejects a role mismatch without issuing auth cookies", async () => {
    identity.getAccount.mockResolvedValue({
      account: { id: sub, role: 1, deactivatedAt: undefined },
    });

    const res = await POST(signInRequest(2));

    expect(res.status).toBe(401);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("reactivates a deactivated account before returning success", async () => {
    identity.getAccount.mockResolvedValue({
      account: { id: sub, role: 1, deactivatedAt: { seconds: 1n, nanos: 0 } },
    });
    identity.reactivateAccount.mockResolvedValue({
      account: { id: sub, role: 1, deactivatedAt: undefined },
    });

    const res = await POST(signInRequest(1));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account: { id: sub, role: 1 },
      reactivated: true,
    });
    expect(identity.reactivateAccount).toHaveBeenCalledWith(
      { sub },
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("rejects an invalid password", async () => {
    const res = await POST(signInRequest(1, "WrongPassword"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({
      error: "電話番号または認証コードが正しくありません",
    });
  });
});
