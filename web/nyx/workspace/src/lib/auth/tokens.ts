/**
 * Token Operations
 *
 * Low-level localStorage operations for authentication tokens.
 * These functions are used by stores/authStore.ts and lib/auth/migration.ts.
 */

export type Role = "guest" | "cast";

export interface TokenData {
  accessToken: string;
  refreshToken: string;
  role: Role;
  userId: string;
}

// Storage key for unified token storage
const STORAGE_KEY = "nyx-auth";

/**
 * Get all tokens from localStorage
 */
export function getTokens(): TokenData | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (!parsed.state) return null;

    const { accessToken, refreshToken, role, userId } = parsed.state;
    if (!accessToken || !refreshToken || !role || !userId) return null;

    return { accessToken, refreshToken, role, userId };
  } catch {
    return null;
  }
}

/**
 * Get access token only
 */
export function getAccessToken(): string | null {
  const tokens = getTokens();
  return tokens?.accessToken ?? null;
}

/**
 * Get current role
 */
export function getRole(): Role | null {
  const tokens = getTokens();
  return tokens?.role ?? null;
}

/**
 * Set tokens to localStorage
 * Note: This is a low-level function. Prefer using authStore.setTokens() instead.
 */
export function setTokens(data: TokenData): void {
  if (typeof window === "undefined") return;

  const stored = {
    state: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      role: data.role,
      userId: data.userId,
    },
    version: 0,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Clear all tokens from localStorage
 */
export function clearTokens(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}
