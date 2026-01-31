/**
 * Auth Module
 *
 * Centralized authentication token management.
 * This module provides low-level token operations.
 *
 * For React components, use stores/authStore.ts instead.
 */

// Token operations
export {
  getAccessToken,
  getRole,
  getTokens,
  setTokens,
  clearTokens,
  isAuthenticated,
  type Role,
  type TokenData,
} from "./tokens";

// Migration utilities
export { migrateTokens, hasLegacyTokens } from "./migration";
