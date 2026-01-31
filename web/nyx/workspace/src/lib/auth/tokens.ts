/**
 * Token management utilities
 *
 * Centralized token storage keys and helper functions.
 * All token operations should go through these utilities.
 */

export type UserRole = "cast" | "guest";

/**
 * Storage keys for authentication tokens
 */
export const TOKEN_KEYS = {
  CAST_ACCESS: "nyx_cast_access_token",
  CAST_REFRESH: "nyx_cast_refresh_token",
  GUEST_ACCESS: "nyx_guest_access_token",
  GUEST_REFRESH: "nyx_guest_refresh_token",
} as const;

export type TokenKeys = {
  access: string;
  refresh: string;
};

/**
 * Get token storage keys based on user role
 */
export function getTokenKeys(role: UserRole): TokenKeys {
  if (role === "cast") {
    return {
      access: TOKEN_KEYS.CAST_ACCESS,
      refresh: TOKEN_KEYS.CAST_REFRESH,
    };
  }
  return {
    access: TOKEN_KEYS.GUEST_ACCESS,
    refresh: TOKEN_KEYS.GUEST_REFRESH,
  };
}

/**
 * Infer role from URL pathname
 */
export function inferRoleFromPath(pathname: string | null): UserRole {
  if (pathname?.startsWith("/cast")) {
    return "cast";
  }
  return "guest";
}

/**
 * Infer role from API role value
 */
export function inferRoleFromApiRole(role: number | string | undefined): UserRole {
  if (role === 2 || role === "ROLE_CAST") {
    return "cast";
  }
  return "guest";
}

/**
 * Get access token for a given role
 */
export function getAccessToken(role: UserRole): string | null {
  if (typeof window === "undefined") return null;
  const keys = getTokenKeys(role);
  return localStorage.getItem(keys.access);
}

/**
 * Get refresh token for a given role
 */
export function getRefreshToken(role: UserRole): string | null {
  if (typeof window === "undefined") return null;
  const keys = getTokenKeys(role);
  return localStorage.getItem(keys.refresh);
}

/**
 * Set tokens for a given role
 */
export function setTokens(
  role: UserRole,
  tokens: { accessToken?: string; refreshToken?: string }
): void {
  if (typeof window === "undefined") return;
  const keys = getTokenKeys(role);

  if (tokens.accessToken) {
    localStorage.setItem(keys.access, tokens.accessToken);
  }
  if (tokens.refreshToken) {
    localStorage.setItem(keys.refresh, tokens.refreshToken);
  }
}

/**
 * Clear tokens for a given role
 */
export function clearTokens(role: UserRole): void {
  if (typeof window === "undefined") return;
  const keys = getTokenKeys(role);
  localStorage.removeItem(keys.access);
  localStorage.removeItem(keys.refresh);
}

/**
 * Check if user has valid tokens for a given role
 */
export function hasTokens(role: UserRole): boolean {
  return getAccessToken(role) !== null;
}

/**
 * Normalize token response from API (handles snake_case and camelCase)
 */
export function normalizeTokenResponse(data: Record<string, unknown>): {
  accessToken?: string;
  refreshToken?: string;
} {
  return {
    accessToken: (data.accessToken || data.access_token) as string | undefined,
    refreshToken: (data.refreshToken || data.refresh_token) as string | undefined,
  };
}
