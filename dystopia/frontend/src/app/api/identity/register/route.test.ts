import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createFakeAdapter, _resetFakePool } from "@/lib/cognito/fake";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

describe("POST /api/identity/register", () => {
  beforeEach(() => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    cognitoMocks.adapter = createFakeAdapter();
  });

  it("SignUp 成功時に 200 を返し cookie は発行しない", async () => {
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });

  it("既存 phone_number は 409 を返す", async () => {
    const req1 = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" }),
    });
    await POST(req1);
    const req2 = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "AnotherPass!" }),
    });
    const res = await POST(req2);
    expect(res.status).toBe(409);
  });
});
