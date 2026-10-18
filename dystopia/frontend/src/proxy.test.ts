import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/cookies";
import { _resetFakePool, createFakeAdapter, FAKE_CONFIRMATION_CODE } from "@/lib/cognito/fake";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

const { proxy } = await import("./proxy");

function unsignedToken(exp: number): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode({ sub: "user-1", exp })}.`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

function request(path: string, cookies: Record<string, string>) {
  const req = new NextRequest(`http://localhost${path}`);
  for (const [name, value] of Object.entries(cookies)) req.cookies.set(name, value);
  return req;
}

const forwardedCookie = (res: Response) => res.headers.get("x-middleware-request-cookie") ?? "";

describe("proxy", () => {
  let refreshToken: string;

  beforeEach(async () => {
    _resetFakePool();
    cognitoMocks.adapter = createFakeAdapter();
    await cognitoMocks.adapter.signUp("+15551234567", "Passw0rd!");
    await cognitoMocks.adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    ({ refreshToken } = await cognitoMocks.adapter.initiateAuth("+15551234567", "Passw0rd!"));
  });

  it("refreshes when the access cookie is gone and hands the new token to the route and the browser", async () => {
    const res = await proxy(request("/api/feed", { [REFRESH_COOKIE]: refreshToken }));

    const browserAccess = res.cookies.get(ACCESS_COOKIE)?.value;
    expect(browserAccess).toBeTruthy();
    expect(res.cookies.get(REFRESH_COOKIE)?.value).toBe(refreshToken);
    expect(forwardedCookie(res)).toContain(`${ACCESS_COOKIE}=${browserAccess}`);
  });

  it("refreshes an access token that expires within a minute", async () => {
    const res = await proxy(
      request("/api/feed", { [ACCESS_COOKIE]: unsignedToken(nowSeconds() + 30), [REFRESH_COOKIE]: refreshToken }),
    );

    expect(res.cookies.get(ACCESS_COOKIE)?.value).toBeTruthy();
  });

  it("leaves a fresh access token alone", async () => {
    const res = await proxy(
      request("/api/feed", { [ACCESS_COOKIE]: unsignedToken(nowSeconds() + 3000), [REFRESH_COOKIE]: refreshToken }),
    );

    expect(res.cookies.get(ACCESS_COOKIE)).toBeUndefined();
    expect(forwardedCookie(res)).toBe("");
  });

  it("does nothing without a refresh cookie", async () => {
    const res = await proxy(request("/api/feed", {}));

    expect(res.cookies.get(ACCESS_COOKIE)).toBeUndefined();
    expect(forwardedCookie(res)).toBe("");
  });

  it("passes the request through when the refresh fails", async () => {
    const res = await proxy(request("/api/feed", { [REFRESH_COOKIE]: "revoked" }));

    expect(res.cookies.get(ACCESS_COOKIE)).toBeUndefined();
    expect(forwardedCookie(res)).toBe("");
  });

  it("refreshes for the session check but not for the other identity routes", async () => {
    const me = await proxy(request("/api/identity/me", { [REFRESH_COOKIE]: refreshToken }));
    const signIn = await proxy(request("/api/identity/sign-in", { [REFRESH_COOKIE]: refreshToken }));
    const deactivate = await proxy(request("/api/identity/deactivate", { [REFRESH_COOKIE]: refreshToken }));

    expect(me.cookies.get(ACCESS_COOKIE)?.value).toBeTruthy();
    expect(signIn.cookies.get(ACCESS_COOKIE)).toBeUndefined();
    expect(deactivate.cookies.get(ACCESS_COOKIE)).toBeUndefined();
  });
});
