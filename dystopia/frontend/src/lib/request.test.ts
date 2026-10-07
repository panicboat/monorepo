import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { ACCESS_COOKIE } from "./auth/cookies";
import { REFRESH_COOKIE } from "./auth/cookies";
import {
  createFakeAdapter,
  _resetFakePool,
  FAKE_CONFIRMATION_CODE,
} from "./cognito/fake";
import { ConnectError } from "@connectrpc/connect";
import { GrpcCode } from "./grpc-errors";
import { buildGrpcHeaders } from "./request";
import { callWithRefresh } from "./auth/refresh-on-unauthenticated";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

const originalCognitoAdapter = process.env.COGNITO_ADAPTER;

describe("buildGrpcHeaders", () => {
  beforeEach(() => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    cognitoMocks.adapter = null;
  });

  afterEach(() => {
    if (originalCognitoAdapter === undefined) {
      delete process.env.COGNITO_ADAPTER;
    } else {
      process.env.COGNITO_ADAPTER = originalCognitoAdapter;
    }
  });

  it("returns only X-Request-ID without an access token cookie", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });

    const headers = await buildGrpcHeaders(req);

    expect(headers["X-Request-ID"]).toBeDefined();
    expect(headers["x-user-id"]).toBeUndefined();
    expect(headers.Authorization).toBeUndefined();
  });

  it("forwards the verified token subject as x-user-id", async () => {
    const adapter = createFakeAdapter();
    const { userSub } = await adapter.signUp(
      "+15551234567",
      "Passw0rd!Passw0rd!",
    );
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth(
      "+15551234567",
      "Passw0rd!Passw0rd!",
    );
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-user-id"]).toBe(userSub);
    expect(headers.Authorization).toBeUndefined();
  });

  it("forwards x-profile-id alongside a verified x-user-id", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "x-profile-id": "0199c0de-0000-7000-8000-0000000000aa" },
    });
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-profile-id"]).toBe("0199c0de-0000-7000-8000-0000000000aa");
  });

  it("omits x-profile-id when the request has none", async () => {
    const adapter = createFakeAdapter();
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const tokens = await adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!");
    const req = new NextRequest("http://localhost/api/test", { method: "POST" });
    req.cookies.set(ACCESS_COOKIE, tokens.accessToken);

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-profile-id"]).toBeUndefined();
  });

  it("does not forward x-profile-id without a verified access token", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "x-profile-id": "0199c0de-0000-7000-8000-0000000000aa" },
    });

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-profile-id"]).toBeUndefined();
    expect(headers["x-user-id"]).toBeUndefined();
  });

  it("omits x-user-id when the access token is malformed", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    req.cookies.set(ACCESS_COOKIE, "not.a.jwt");

    const headers = await buildGrpcHeaders(req);

    expect(headers["x-user-id"]).toBeUndefined();
  });

  it("retries with x-user-id from a refreshed access token", async () => {
    const adapter = createFakeAdapter();
    cognitoMocks.adapter = adapter;
    const { userSub } = await adapter.signUp(
      "+15551234567",
      "Passw0rd!Passw0rd!",
    );
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const refreshedTokens = await adapter.initiateAuth(
      "+15551234567",
      "Passw0rd!Passw0rd!",
    );
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    req.cookies.set(ACCESS_COOKIE, "not.a.jwt");
    req.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken);

    const result = await callWithRefresh(req, async (headers) => {
      if (!headers["x-user-id"]) {
        throw new ConnectError("unauthenticated", GrpcCode.UNAUTHENTICATED);
      }
      expect(headers["x-user-id"]).toBe(userSub);
      expect(headers.Authorization).toBeUndefined();
      return "retried";
    });

    expect(result).toEqual({
      ok: true,
      data: "retried",
      refreshed: {
        accessToken: expect.any(String),
        refreshToken: refreshedTokens.refreshToken,
      },
    });
  });

  it("retries with x-profile-id from the request after refreshing the access token", async () => {
    const adapter = createFakeAdapter();
    cognitoMocks.adapter = adapter;
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const refreshedTokens = await adapter.initiateAuth(
      "+15551234567",
      "Passw0rd!Passw0rd!",
    );
    const profileId = "0199c0de-0000-7000-8000-0000000000aa";
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
      headers: { "x-profile-id": profileId },
    });
    req.cookies.set(ACCESS_COOKIE, "not.a.jwt");
    req.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken);

    await callWithRefresh(req, async (headers) => {
      if (!headers["x-user-id"]) {
        throw new ConnectError("unauthenticated", GrpcCode.UNAUTHENTICATED);
      }
      expect(headers["x-profile-id"]).toBe(profileId);
      return "retried";
    });
  });

  it("retries without x-profile-id when the request has none", async () => {
    const adapter = createFakeAdapter();
    cognitoMocks.adapter = adapter;
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    const refreshedTokens = await adapter.initiateAuth(
      "+15551234567",
      "Passw0rd!Passw0rd!",
    );
    const req = new NextRequest("http://localhost/api/test", {
      method: "POST",
    });
    req.cookies.set(ACCESS_COOKIE, "not.a.jwt");
    req.cookies.set(REFRESH_COOKIE, refreshedTokens.refreshToken);

    await callWithRefresh(req, async (headers) => {
      if (!headers["x-user-id"]) {
        throw new ConnectError("unauthenticated", GrpcCode.UNAUTHENTICATED);
      }
      expect(headers["x-profile-id"]).toBeUndefined();
      return "retried";
    });
  });
});
