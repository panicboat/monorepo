import { generateKeyPairSync, randomUUID } from "node:crypto";
import { exportJWK, SignJWT, type JWK } from "jose";
import type { CognitoAdapter, Tokens } from "./adapter";

type FakeUser = {
  sub: string;
  password: string;
  confirmed: boolean;
};

const users = new Map<string, FakeUser>();
export const FAKE_CONFIRMATION_CODE = "000000";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

export async function fakeJwks(): Promise<{ keys: JWK[] }> {
  const jwk = await exportJWK(publicKey);
  return { keys: [{ ...jwk, kid: "fake-kid", alg: "RS256", use: "sig" }] };
}

async function signAccessToken(sub: string, expSeconds = 3600): Promise<string> {
  return new SignJWT({ token_use: "access" })
    .setProtectedHeader({ alg: "RS256", kid: "fake-kid" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(`${expSeconds}s`)
    .setIssuer("fake-issuer")
    .sign(privateKey);
}

export function createFakeAdapter(): CognitoAdapter {
  return {
    async signUp(phone, password) {
      if (users.has(phone)) throw new Error("UsernameExistsException");

      const sub = randomUUID();
      users.set(phone, { sub, password, confirmed: false });
      return { userSub: sub };
    },
    async confirmSignUp(phone, code) {
      const user = users.get(phone);
      if (!user) throw new Error("UserNotFoundException");
      if (code !== FAKE_CONFIRMATION_CODE) throw new Error("CodeMismatchException");

      user.confirmed = true;
    },
    async initiateAuth(phone, password): Promise<Tokens> {
      const user = users.get(phone);
      if (!user) throw new Error("UserNotFoundException");
      if (!user.confirmed) throw new Error("UserNotConfirmedException");
      if (user.password !== password) throw new Error("NotAuthorizedException");

      const accessToken = await signAccessToken(user.sub);
      const idToken = await signAccessToken(user.sub);
      return {
        accessToken,
        refreshToken: `fake-refresh:${user.sub}`,
        idToken,
      };
    },
    async refreshTokens(refreshToken) {
      const sub = refreshToken.startsWith("fake-refresh:")
        ? refreshToken.slice("fake-refresh:".length)
        : null;
      if (!sub) throw new Error("NotAuthorizedException");

      const accessToken = await signAccessToken(sub);
      const idToken = await signAccessToken(sub);
      return { accessToken, idToken };
    },
    async globalSignOut() {},
    async forgotPassword(phone) {
      if (!users.has(phone)) throw new Error("UserNotFoundException");
    },
    async confirmForgotPassword(phone, code, newPassword) {
      const user = users.get(phone);
      if (!user) throw new Error("UserNotFoundException");
      if (code !== FAKE_CONFIRMATION_CODE) throw new Error("CodeMismatchException");

      user.password = newPassword;
    },
  };
}

export function _resetFakePool(): void {
  users.clear();
}
