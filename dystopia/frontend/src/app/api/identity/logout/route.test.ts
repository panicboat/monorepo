import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "@/lib/auth/cookies";
import { POST } from "./route";

const cognitoMocks = vi.hoisted(() => ({
  globalSignOut: vi.fn(),
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => ({ globalSignOut: cognitoMocks.globalSignOut }),
}));

describe("POST /api/identity/logout", () => {
  it("access token を GlobalSignOut に渡し cookie を clear して 200 を返す", async () => {
    cognitoMocks.globalSignOut.mockReset();
    cognitoMocks.globalSignOut.mockResolvedValue(undefined);
    const req = new NextRequest("http://localhost/api/identity/logout", {
      method: "POST",
    });
    req.cookies.set(ACCESS_COOKIE, "access-token");

    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("Set-Cookie")).toMatch(/access_token=;/);
    expect(cognitoMocks.globalSignOut).toHaveBeenCalledWith("access-token");
  });
});
