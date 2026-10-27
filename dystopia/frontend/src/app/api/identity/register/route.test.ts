import { beforeEach, describe, expect, it, vi } from "vitest";
import { Code, ConnectError } from "@connectrpc/connect";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { createFakeAdapter, _resetFakePool, FAKE_CONFIRMATION_CODE } from "@/lib/cognito/fake";

const cognitoMocks = vi.hoisted(() => ({
  adapter: null as ReturnType<typeof createFakeAdapter> | null,
}));

const identity = vi.hoisted(() => ({ getAccount: vi.fn() }));

vi.mock("@/lib/grpc", () => ({
  identityClient: { getAccount: identity.getAccount },
}));

vi.mock("@/lib/cognito/adapter", () => ({
  cognito: () => cognitoMocks.adapter!,
}));

describe("POST /api/identity/register", () => {
  beforeEach(() => {
    _resetFakePool();
    process.env.COGNITO_ADAPTER = "fake";
    cognitoMocks.adapter = createFakeAdapter();
    identity.getAccount.mockReset();
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

  it("確認済みでアカウントのある phone_number は 409 を返す", async () => {
    const adapter = cognitoMocks.adapter!;
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    identity.getAccount.mockResolvedValue({ account: { id: "account-id" } });
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "AnotherPass!" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "この電話番号は既に登録されています" });
  });

  it("未確認の phone_number は解放して新しいパスワードで登録し直せる", async () => {
    const adapter = cognitoMocks.adapter!;
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "AnotherPass1!AnotherPass1!" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    await expect(
      adapter.initiateAuth("+15551234567", "AnotherPass1!AnotherPass1!"),
    ).resolves.toBeTruthy();
    await expect(adapter.initiateAuth("+15551234567", "Passw0rd!Passw0rd!")).rejects.toMatchObject({
      name: "NotAuthorizedException",
    });
  });

  it("確認済みでもアカウントのない phone_number は解放して登録し直せる", async () => {
    const adapter = cognitoMocks.adapter!;
    await adapter.signUp("+15551234567", "Passw0rd!Passw0rd!");
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    identity.getAccount.mockRejectedValue(new ConnectError("account not found", Code.NotFound));
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "AnotherPass1!AnotherPass1!" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(200);
    await adapter.confirmSignUp("+15551234567", FAKE_CONFIRMATION_CODE);
    await expect(
      adapter.initiateAuth("+15551234567", "AnotherPass1!AnotherPass1!"),
    ).resolves.toBeTruthy();
  });

  it("解放後の再 SignUp がまた既存扱いなら 409 を返し、再試行は 1 回だけにする", async () => {
    const error = new Error("User already exists");
    error.name = "UsernameExistsException";
    const signUp = vi.fn().mockRejectedValue(error);
    const releaseIncompleteSignUp = vi.fn().mockResolvedValue(true);
    cognitoMocks.adapter = { ...createFakeAdapter(), signUp, releaseIncompleteSignUp };
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    expect(signUp).toHaveBeenCalledTimes(2);
    expect(releaseIncompleteSignUp).toHaveBeenCalledTimes(1);
  });

  it("解放されなかったときは再 SignUp せずに 409 を返す", async () => {
    const error = new Error("User already exists");
    error.name = "UsernameExistsException";
    const signUp = vi.fn().mockRejectedValue(error);
    cognitoMocks.adapter = {
      ...createFakeAdapter(),
      signUp,
      releaseIncompleteSignUp: async () => false,
    };
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
    expect(signUp).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when the retried SignUp rejects the password", async () => {
    const exists = new Error("User already exists");
    exists.name = "UsernameExistsException";
    const invalidPassword = new Error("Password did not conform with policy");
    invalidPassword.name = "InvalidPasswordException";
    cognitoMocks.adapter = {
      ...createFakeAdapter(),
      signUp: vi.fn().mockRejectedValueOnce(exists).mockRejectedValueOnce(invalidPassword),
      releaseIncompleteSignUp: async () => true,
    };
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "short" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns the error response when releasing the sign-up fails", async () => {
    const exists = new Error("User already exists");
    exists.name = "UsernameExistsException";
    cognitoMocks.adapter = {
      ...createFakeAdapter(),
      signUp: async () => {
        throw exists;
      },
      releaseIncompleteSignUp: async () => {
        throw new ConnectError("unavailable", Code.Unavailable);
      },
    };
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(500);
  });

  it("returns 409 when Cognito provides the exception class in name", async () => {
    const error = new Error("User already exists");
    error.name = "UsernameExistsException";
    cognitoMocks.adapter = {
      ...createFakeAdapter(),
      signUp: async () => {
        throw error;
      },
    };
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "Passw0rd!Passw0rd!" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(409);
  });

  it("returns 400 with the requirements when Cognito rejects the password", async () => {
    const error = new Error("Password did not conform with policy: Password not long enough");
    error.name = "InvalidPasswordException";
    cognitoMocks.adapter = {
      ...createFakeAdapter(),
      signUp: async () => {
        throw error;
      },
    };
    const req = new NextRequest("http://localhost/api/identity/register", {
      method: "POST",
      body: JSON.stringify({ phoneNumber: "+15551234567", password: "short" }),
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error:
        "パスワードが条件を満たしていません。12 文字以上で、大文字・小文字・数字・記号をそれぞれ 1 文字以上含めてください。",
    });
  });
});
