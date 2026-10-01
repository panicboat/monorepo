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

// Subs mirror the fixed account ids in monolith config/db/seeds/identity/users.rb so seeded accounts can sign in.
const SEED_USERS: Array<{ phone: string; sub: string }> = [
  { phone: "+819000000101", sub: "11111111-1111-4111-8111-111111111111" },
  { phone: "+819000000102", sub: "22222222-2222-4222-8222-222222222222" },
  { phone: "+819000000103", sub: "33333333-3333-4333-8333-333333333333" },
  { phone: "+819000000104", sub: "44444444-4444-4444-8444-444444444444" },
  { phone: "+819000000105", sub: "55555555-5555-4555-8555-555555555555" },
  { phone: "+819000000106", sub: "66666666-6666-4666-8666-666666666666" },
  { phone: "+819000000107", sub: "77777777-7777-4777-8777-777777777777" },
];

function seedDevUsers(): void {
  for (const { phone, sub } of SEED_USERS) {
    users.set(phone, { sub, password: "password", confirmed: true });
  }
}
seedDevUsers();

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
  seedDevUsers();
}
