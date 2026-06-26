/**
 * Auth Module
 *
 * Tokens are held in httpOnly cookies set by the BFF (see ./cookies.ts).
 * Client JS does not read or attach them. authFetch is just an error-handling
 * fetch wrapper; cookies ride along automatically (same-origin).
 */

export { authFetch, type AuthFetchOptions } from "./fetch";

export type Role = "guest" | "cast";
