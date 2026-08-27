import { createRemoteJWKSet, importJWK, jwtVerify, type JWTPayload } from "jose";
import { fakeJwks } from "./fake";

async function localVerifier(token: string): Promise<{ sub: string }> {
  const jwks = await fakeJwks();
  const key = await importJWK(jwks.keys[0]);
  const { payload } = await jwtVerify(token, key, { issuer: "fake-issuer" });
  return extractSub(payload);
}

async function awsVerifier(token: string): Promise<{ sub: string }> {
  const region = process.env.COGNITO_REGION ?? "ap-northeast-1";
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!poolId) throw new Error("COGNITO_USER_POOL_ID env is required");

  const issuer = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  const { payload } = await jwtVerify(token, jwks, { issuer });
  return extractSub(payload);
}

function extractSub(payload: JWTPayload): { sub: string } {
  if (typeof payload.sub !== "string") throw new Error("invalid token: no sub");
  return { sub: payload.sub };
}

export async function verifyAccessToken(token: string): Promise<{ sub: string }> {
  return process.env.COGNITO_ADAPTER === "aws" ? awsVerifier(token) : localVerifier(token);
}
