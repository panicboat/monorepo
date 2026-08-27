import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  _resetFakePool,
  FAKE_CONFIRMATION_CODE,
  createFakeAdapter,
} from "@/lib/cognito/fake";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/grpc", () => ({
  identityClient: {
    createAccount: vi.fn(),
  },
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

const { identityClient } = await import("@/lib/grpc");
const identity = identityClient as unknown as {
  createAccount: ReturnType<typeof vi.fn>;
};

describe("POST /api/identity/verify", () => {
  beforeEach(async () => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    const fake = createFakeAdapter();
    cognitoMocks.adapter = fake;
    await fake.signUp("+15551234567", "Passw0rd!Passw0rd!");
    identity.createAccount.mockReset();
    identity.createAccount.mockResolvedValue({
      account: { id: "will-be-cognito-sub", role: 1 },
    });
  });

  it("confirms the code, creates the account, and issues auth cookies", async () => {
    const { POST } = await import("./route");
    identity.createAccount.mockImplementation(async ({ sub, role }) => ({
      account: { id: sub, role },
    }));

    const req = new NextRequest("http://localhost/api/identity/verify", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: "+15551234567",
        code: FAKE_CONFIRMATION_CODE,
        password: "Passw0rd!Passw0rd!",
        role: 1,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      account: { id: expect.any(String), role: 1 },
    });
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=/);
    expect(identity.createAccount).toHaveBeenCalledOnce();
  });

  it("rejects an incorrect code without creating an account", async () => {
    const { POST } = await import("./route");
    const req = new NextRequest("http://localhost/api/identity/verify", {
      method: "POST",
      body: JSON.stringify({
        phoneNumber: "+15551234567",
        code: "999999",
        password: "Passw0rd!Passw0rd!",
        role: 1,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(identity.createAccount).not.toHaveBeenCalled();
  });
});
