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

function cognitoError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

export function createFakeAdapter(): CognitoAdapter {
  return {
    async signUp(phone, password) {
      if (users.has(phone)) {
        throw cognitoError("UsernameExistsException", "User already exists");
      }

      const sub = randomUUID();
      users.set(phone, { sub, password, confirmed: false });
      return { userSub: sub };
    },
    async confirmSignUp(phone, code) {
      const user = users.get(phone);
      if (!user) throw cognitoError("UserNotFoundException", "User not found");
      if (code !== FAKE_CONFIRMATION_CODE) {
        throw cognitoError("CodeMismatchException", "Confirmation code is invalid");
      }

      user.confirmed = true;
    },
    async initiateAuth(phone, password): Promise<Tokens> {
      const user = users.get(phone);
      if (!user) throw cognitoError("UserNotFoundException", "User not found");
      if (!user.confirmed) {
        throw cognitoError("UserNotConfirmedException", "User is not confirmed");
      }
      if (user.password !== password) {
        throw cognitoError("NotAuthorizedException", "Incorrect username or password");
      }

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
      if (!sub) {
        throw cognitoError("NotAuthorizedException", "Invalid refresh token");
      }

      const accessToken = await signAccessToken(sub);
      const idToken = await signAccessToken(sub);
      return { accessToken, idToken };
    },
    async globalSignOut() {},
    async forgotPassword(phone) {
      if (!users.has(phone)) {
        throw cognitoError("UserNotFoundException", "User not found");
      }
    },
    async confirmForgotPassword(phone, code, newPassword) {
      const user = users.get(phone);
      if (!user) throw cognitoError("UserNotFoundException", "User not found");
      if (code !== FAKE_CONFIRMATION_CODE) {
        throw cognitoError("CodeMismatchException", "Confirmation code is invalid");
      }

      user.password = newPassword;
    },
  };
}

export function _resetFakePool(): void {
  users.clear();
}
