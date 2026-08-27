import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { _resetFakePool, createFakeAdapter } from "@/lib/cognito/fake";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

describe("POST /api/identity/forgot-password", () => {
  beforeEach(async () => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    const fake = createFakeAdapter();
    cognitoMocks.adapter = fake;
    await fake.signUp("+15551234567", "Passw0rd!");
  });

  it("returns 200 for an existing phone number", async () => {
    const req = new NextRequest("http://localhost/api/identity/forgot-password", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("returns 200 for a nonexistent phone number to prevent user enumeration", async () => {
    const req = new NextRequest("http://localhost/api/identity/forgot-password", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+19999999999" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});
