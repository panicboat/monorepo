/**
 * Token Migration
 *
 * Migrates tokens from legacy localStorage keys to the new unified format.
 * Legacy keys: nyx_{role}_access_token, nyx_{role}_refresh_token, nyx_{role}_user_id
 * New key: nyx-auth (Zustand persist format)
 */

import { type Role, type TokenData, setTokens } from "./tokens";

// Legacy storage keys
const LEGACY_KEYS = {
  cast: {
    accessToken: "nyx_cast_access_token",
    refreshToken: "nyx_cast_refresh_token",
    userId: "nyx_cast_user_id",
  },
  guest: {
    accessToken: "nyx_guest_access_token",
    refreshToken: "nyx_guest_refresh_token",
    userId: "nyx_guest_user_id",
  },
} as const;

// Migration status key
const MIGRATION_STATUS_KEY = "nyx-auth-migrated";

interface LegacyTokens {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
}

/**
 * Read legacy tokens for a specific role
 */
function readLegacyTokens(role: Role): LegacyTokens {
  if (typeof window === "undefined") {
    return { accessToken: null, refreshToken: null, userId: null };
  }

  const keys = LEGACY_KEYS[role];
  return {
    accessToken: localStorage.getItem(keys.accessToken),
    refreshToken: localStorage.getItem(keys.refreshToken),
    userId: localStorage.getItem(keys.userId),
  };
}

/**
 * Clear legacy tokens for a specific role
 */
function clearLegacyTokens(role: Role): void {
  if (typeof window === "undefined") return;

  const keys = LEGACY_KEYS[role];
  localStorage.removeItem(keys.accessToken);
  localStorage.removeItem(keys.refreshToken);
  localStorage.removeItem(keys.userId);
}

/**
 * Check if migration has already been performed
 */
function isMigrated(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(MIGRATION_STATUS_KEY) === "true";
}

/**
 * Mark migration as complete
 */
function markMigrated(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(MIGRATION_STATUS_KEY, "true");
}

/**
 * Migrate legacy tokens to new format
 *
 * Priority: cast tokens take precedence over guest tokens
 * (if both exist, cast session is preserved)
 *
 * @returns The migrated token data, or null if no valid tokens were found
 */
export function migrateTokens(): TokenData | null {
  if (typeof window === "undefined") return null;

  // Skip if already migrated
  if (isMigrated()) return null;

  // Try cast tokens first (higher priority)
  const castTokens = readLegacyTokens("cast");
  if (castTokens.accessToken && castTokens.refreshToken && castTokens.userId) {
    const data: TokenData = {
      accessToken: castTokens.accessToken,
      refreshToken: castTokens.refreshToken,
      role: "cast",
      userId: castTokens.userId,
    };

    setTokens(data);
    clearLegacyTokens("cast");
    clearLegacyTokens("guest"); // Clear guest tokens too
    markMigrated();

    return data;
  }

  // Try guest tokens
  const guestTokens = readLegacyTokens("guest");
  if (
    guestTokens.accessToken &&
    guestTokens.refreshToken &&
    guestTokens.userId
  ) {
    const data: TokenData = {
      accessToken: guestTokens.accessToken,
      refreshToken: guestTokens.refreshToken,
      role: "guest",
      userId: guestTokens.userId,
    };

    setTokens(data);
    clearLegacyTokens("guest");
    markMigrated();

    return data;
  }

  // No valid tokens found, mark as migrated anyway
  markMigrated();
  return null;
}

/**
 * Check if there are legacy tokens that need migration
 */
export function hasLegacyTokens(): boolean {
  if (typeof window === "undefined") return false;
  if (isMigrated()) return false;

  const castTokens = readLegacyTokens("cast");
  const guestTokens = readLegacyTokens("guest");

  return !!(
    castTokens.accessToken ||
    castTokens.refreshToken ||
    guestTokens.accessToken ||
    guestTokens.refreshToken
  );
}
